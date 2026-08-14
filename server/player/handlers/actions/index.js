/**
 * Actions from context-menu.
 * for example: (take, drop, pickup, etc.)
 */

import { Bank, Shop } from '#server/core/functions/index.js';
import { wearableItems } from '#server/core/data/items/index.js';

import config from '#server/config.js';
import Action from '#server/player/action.js';
import ContextMenu from '#server/core/context-menu.js';
import Item from '#server/core/item.js';
import GameMap from '#server/core/map.js';
import Player from '#server/core/player.js';
import Wear from '#server/core/utilities/wear.js';
import Query from '#server/core/data/query.js';
import Socket from '#server/socket.js';
import UI from '#shared/ui.js';
import {
  INVENTORY_COLUMNS,
  canPlaceInventoryItem,
  positionFromSlot,
  slotFromPosition,
} from '#shared/inventory-footprints.js';
import { canItemUseSlot, resolveEquipSlot } from '#shared/wear-slots.js';
import pipe from '#server/player/pipeline/index.js';
import ItemFactory from '#server/core/items/factory.js';
import { vesselEligible } from '#server/core/items/vesselforge/adapter.js';
import world from '#server/core/world.js';
import { notifyProgression } from '#server/core/progression-events.js';
import chroniclesStore from '#server/core/services/chronicles-store.js';
import { notifyTutorial } from '#server/core/tutorial.js';
import { commitGroundItemPickup, refreshInventory } from '#server/core/items/pickup.js';
import { MAIN_TOWN_FOUNTAIN } from '#server/core/town-amenities.js';
import { talkToAldwyn } from '#server/core/first-goal.js';
import { applyVesselCombatStats, getForge, vesselTooltip } from '#server/core/items/vesselforge/adapter.js';
import { BRAND_COST } from '#server/core/context-menu/strategies/vesselforge-brand.js';
import playerPersistence from '#server/core/services/player-persistence.js';
import chroniclesRepository from '#server/core/repositories/chronicles-repository.js';
import wagonService, { wagonNpcId } from '#server/core/services/wagon-service.js';
import { publicPlayerProjection } from '#server/core/entities/player/public-projection.js';
import { occupiedTile } from '#shared/movement.js';

const notifyLootProgression = (player, item) => {
  notifyProgression(player, 'loot');
  if (vesselEligible(item)) {
    notifyProgression(player, 'loot-vessel');
  }
};

const sendInventoryError = (player, text) => {
  if (!player || !player.socket_id) {
    return;
  }

  Socket.emit('game:send:message', {
    player: { socket_id: player.socket_id },
    text,
  });
  refreshInventory(player);
};

const getPlayerFromPayload = (incoming) => {
  const payload = incoming.data || {};
  const socketId = payload.player?.socket_id
    || incoming.player?.socket_id
    || incoming.socketId
    || incoming.todo?.player?.socket_id;
  const playerId = payload.id
    || incoming.id
    || payload.player?.uuid
    || incoming.player?.uuid
    || incoming.playerUuid
    || incoming.todo?.player?.uuid;

  const stablePlayer = world.players.find((player) => (
    (playerId && player.uuid === playerId)
    || (socketId && player.socket_id === socketId)
  ));

  if (stablePlayer) {
    return stablePlayer;
  }

  return Number.isInteger(incoming.playerIndex)
    ? world.players[incoming.playerIndex] || null
    : null;
};

const getActionPlayer = (incoming = {}) => {
  if (Number.isInteger(incoming.playerIndex)) {
    return world.players[incoming.playerIndex] || null;
  }
  return getPlayerFromPayload(incoming) || null;
};

const getActionMiscData = (incoming = {}) => (
  incoming.data?.data?.miscData
  || incoming.data?.miscData
  || incoming.miscData
  || {}
);

const resolveItemActionPayload = (incoming = {}) => {
  const nested = incoming.data && typeof incoming.data === 'object' ? incoming.data : {};
  const item = nested.item || incoming.item || {};
  const miscData = item.miscData || nested.miscData || {};

  return {
    payload: nested.item ? nested : incoming,
    item: item.miscData ? item : { ...item, miscData },
    miscData,
  };
};

/**
 * Chebyshev distance guard for world interactions. Legit clients walk to a
 * target before the queued action fires, so the player is always adjacent;
 * anything beyond this margin is a crafted packet (e.g. remote-looting or
 * remote-mining from across the map).
 */
const ACTION_REACH_TILES = 10;
const isWithinReach = (player, coords, reach = ACTION_REACH_TILES) => {
  if (!player || !coords || !Number.isFinite(coords.x) || !Number.isFinite(coords.y)) {
    return false;
  }

  return Math.max(Math.abs(player.x - coords.x), Math.abs(player.y - coords.y)) <= reach;
};

const isActiveResourcePane = (player, pane, objectId) => {
  const anchor = player?.currentPaneAnchor;
  return Boolean(
    player
    && player.currentPane === pane
    && anchor
    && anchor.pane === pane
    && anchor.objectId === objectId
    && anchor.sceneId === player.sceneId
    && isWithinReach(player, anchor, 2),
  );
};

const NPC_INTERACTION_REACH_TILES = 4;
const NPC_PANE_REACH_TILES = 4;

const sameIdentifier = (left, right) => (
  left !== undefined
  && left !== null
  && right !== undefined
  && right !== null
  && String(left) === String(right)
);

const getSceneNpc = (player, npcId, requiredAction) => {
  if (!player || !sameIdentifier(player.sceneId, world.defaultTownId)) {
    return null;
  }

  const scene = world.getSceneForPlayer(player);
  if (!scene || !Array.isArray(scene.npcs)) {
    return null;
  }

  return scene.npcs.find(npc => (
    npc
    && sameIdentifier(npc.id, npcId)
    && Array.isArray(npc.actions)
    && npc.actions.includes(requiredAction)
  )) || null;
};

const isNearNpc = (player, npc, coordinates) => {
  if (!player || !npc || !coordinates) {
    return false;
  }

  const npcTile = {
    x: Math.round(npc.x),
    y: Math.round(npc.y),
  };
  return isWithinReach(player, npcTile, NPC_INTERACTION_REACH_TILES)
    && isWithinReach(npcTile, coordinates, NPC_INTERACTION_REACH_TILES);
};

const openNpcPane = (player, npc, pane, action) => {
  player.currentPane = pane;
  player.objectId = npc.id;
  player.currentPaneAnchor = {
    pane,
    objectId: npc.id,
    npcId: npc.id,
    npcAction: action,
    sceneId: player.sceneId,
    x: player.x,
    y: player.y,
    reach: NPC_PANE_REACH_TILES,
  };
};

const isActiveNpcPane = (player, pane, requiredAction) => {
  const anchor = player?.currentPaneAnchor;
  if (!player || player.currentPane !== pane || !anchor
    || anchor.pane !== pane
    || !sameIdentifier(anchor.objectId, player.objectId)
    || !sameIdentifier(anchor.npcId, player.objectId)
    || anchor.npcAction !== requiredAction
    || !sameIdentifier(anchor.sceneId, player.sceneId)
    || !isWithinReach(player, anchor, anchor.reach || NPC_PANE_REACH_TILES)) {
    return false;
  }

  return Boolean(getSceneNpc(player, anchor.npcId, requiredAction));
};

// Golden plaque shrine: one free item per player per minute.
// NB: `Map` here is the imported game-map class — use globalThis.Map.
const GOLDEN_PLAQUE_COOLDOWN_MS = 60 * 1000;
const goldenPlaqueCooldowns = new globalThis.Map();

const getPlayerScene = player => (
  world.getSceneForPlayer(player) || world.getDefaultTown()
);

const getReachableShopDisplay = (player, reference = {}) => {
  const scene = player ? getPlayerScene(player) : null;
  const display = scene?.items?.find(item => (
    item.shopDisplay
    && item.shopNpcId === reference.id
    && item.id === reference.shopItemId
  ));
  if (!player || !display) return null;
  const playerTile = occupiedTile(player);
  return Math.max(Math.abs(playerTile.x - display.x), Math.abs(playerTile.y - display.y)) <= 1
    ? display
    : null;
};

const SHOPKEEPER_REACH = 2;

const chebyshevWithin = (x1, y1, x2, y2, radius) => (
  Number.isFinite(x1) && Number.isFinite(y1) && Number.isFinite(x2) && Number.isFinite(y2)
  && Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2)) <= radius
);

// A legacy-lane shop trade is only meaningful next to the shopkeeper or one
// of the shop's market displays; a client-echoed npcId is not proof of
// presence (cand-004). The shop-display path keeps its tighter 1-tile rule.
const isShopReachable = (player, shopNpcId) => {
  if (!player || shopNpcId === undefined || shopNpcId === null) {
    return false;
  }
  const scene = getPlayerScene(player);
  if (!scene) {
    return false;
  }
  const playerTile = occupiedTile(player);
  const nearKeeper = (scene.npcs || []).some(npc => npc
    && npc.id === shopNpcId
    && chebyshevWithin(playerTile.x, playerTile.y, npc.x, npc.y, SHOPKEEPER_REACH));
  if (nearKeeper) {
    return true;
  }
  return (scene.items || []).some(item => item
    && item.shopDisplay
    && item.shopNpcId === shopNpcId
    && chebyshevWithin(playerTile.x, playerTile.y, item.x, item.y, 1));
};

// The countinghouse banker is NPC id 4 in a town scene, within one tile -
// the same rule the bank-open handler enforces (cand-005).
const isBankerReachable = (player) => {
  const scene = player ? getPlayerScene(player) : null;
  if (!player || !scene || scene.type !== 'town') {
    return false;
  }
  const banker = (scene.npcs || []).find(npc => npc && npc.id === 4);
  const playerTile = occupiedTile(player);
  return Boolean(banker) && chebyshevWithin(playerTile.x, playerTile.y, banker.x, banker.y, 1);
};

// The context-menu protocol is echo-based: the client sends back the menu
// entry it clicked. Keep the last menu this server built per socket and only
// execute entries it actually offered (cand-003).
const CONTEXT_MENU_OFFER_TTL_MS = 30 * 1000;
const lastOfferedMenus = new Map();

const rememberOfferedMenu = (socketId, items) => {
  if (!socketId || !Array.isArray(items)) {
    return;
  }
  lastOfferedMenus.set(socketId, { items, offeredAt: Date.now() });
};

const menuEntryMatches = (entry, echo) => {
  if (!entry || !echo || !entry.action || !echo.action) {
    return false;
  }
  if (entry.action.actionId !== echo.action.actionId
    || entry.action.name !== echo.action.name) {
    return false;
  }
  if (entry.type && echo.type && entry.type !== echo.type) {
    return false;
  }
  if (entry.id !== undefined && entry.id !== echo.id) {
    return false;
  }
  if (entry.uuid !== undefined && entry.uuid !== echo.uuid) {
    return false;
  }
  if (entry.shopItemId !== undefined && entry.shopItemId !== echo.shopItemId) {
    return false;
  }
  if (entry.params) {
    const echoedQuantity = echo.params ? echo.params.quantity : undefined;
    if (entry.params.quantity !== echoedQuantity) {
      return false;
    }
  }
  return true;
};

const findOfferedMenuEntry = (socketId, echo) => {
  const record = lastOfferedMenus.get(socketId);
  if (!record || (Date.now() - record.offeredAt) > CONTEXT_MENU_OFFER_TTL_MS) {
    return null;
  }
  return record.items.find(entry => menuEntryMatches(entry, echo)) || null;
};

const refreshShopPurchase = (shop, response) => {
  if (!Shop.successfulSale(response)) return false;
  const player = world.players[shop.playerIndex];
  world.shops[shop.shopIndex].inventory = response.shopItems;
  player.inventory.slots = response.inventory;
  playerPersistence.markDirty(player);
  Socket.emit('core:refresh:inventory', {
    player: { socket_id: player.socket_id },
    data: response.inventory,
  });
  if (response.transaction) {
    const itemName = Query.getItemData(response.transaction.itemId)?.name || response.transaction.itemId;
    sendPlayerMessage(
      player,
      `Bought ${response.transaction.quantity} ${itemName} for ${response.transaction.coins} coins.`,
    );
  }
  return true;
};

const getSceneItems = (scene) => {
  if (!scene) {
    return world.items;
  }

  if (!Array.isArray(scene.items)) {
    scene.items = [];
  }

  return scene.items;
};

const getSceneRespawns = (scene) => {
  if (!scene.respawns) {
    scene.respawns = {
      items: [],
      monsters: [],
      resources: [],
    };
  }

  if (!Array.isArray(scene.respawns.items)) {
    scene.respawns.items = [];
  }

  return scene.respawns;
};

const getSceneRecipients = scene => (
  scene && scene.id ? world.getScenePlayers(scene.id) : []
);

const broadcastSceneItems = (scene, eventName) => {
  const items = getSceneItems(scene);
  Socket.broadcast(eventName, items, getSceneRecipients(scene));
};

const getInventoryItemIndex = (slots = [], reference = {}) => {
  if (reference.uuid) {
    return slots.findIndex(item => item && item.uuid === reference.uuid);
  }

  if (Number.isInteger(reference.slot)) {
    const slotIndex = slots.findIndex(item => (
      item
      && item.slot === reference.slot
      && (!reference.id || item.id === reference.id)
    ));
    if (slotIndex !== -1) {
      return slotIndex;
    }
  }

  if (reference.id) {
    return slots.findIndex(item => item && item.id === reference.id);
  }

  return -1;
};

const normaliseInventoryPosition = (payload = {}) => {
  const position = payload.position || payload.target?.position;
  if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) {
    return {
      x: Math.floor(position.x),
      y: Math.floor(position.y),
    };
  }

  const slot = payload.slot ?? payload.target?.slot;
  if (Number.isInteger(slot)) {
    return positionFromSlot(slot, INVENTORY_COLUMNS);
  }

  return null;
};

const isStackable = (item = {}) => (
  item.stackable === true
  || (Number.isFinite(item.maxStack) && item.maxStack > 1)
  || (Number.isFinite(item.qty) && item.qty > 1)
);

const canStackItems = (source, target) => (
  Boolean(source)
  && Boolean(target)
  && source.id === target.id
  && isStackable(source)
  && isStackable(target)
);

const hasStackCapacity = (slots = [], candidate = {}) => (
  isStackable(candidate)
  && slots.some((target) => {
    if (!target || target.id !== candidate.id || !isStackable(target)) {
      return false;
    }
    const maxStack = target.maxStack || candidate.maxStack || Infinity;
    return (Number(target.qty) || 1) < maxStack;
  })
);

const dropInventoryItem = (player, itemIndex) => {
  if (!player || itemIndex < 0 || !player.inventory.slots[itemIndex]) {
    return null;
  }

  const [itemInventory] = player.inventory.slots.splice(itemIndex, 1);
  Player.broadcastMovement(player);

  const dropped = ItemFactory.toWorldInstance(itemInventory, {
    x: player.x,
    y: player.y,
  }, {
    timestamp: Date.now(),
  });

  const scene = getPlayerScene(player);
  world.addItem(dropped, scene.id);
  broadcastSceneItems(scene, 'world:itemDropped');
  broadcastSceneItems(scene, 'item:change');
  refreshInventory(player);

  return dropped;
};

const refreshEquipmentStats = (player) => {
  const playerIndex = world.players.findIndex(p => p.uuid === player.uuid);
  if (playerIndex === -1) {
    return;
  }

  const combatStats = Wear.updateCombat(playerIndex);
  player.combat = {
    ...player.combat,
    attack: combatStats.attack,
    defense: combatStats.defense,
    blockChance: combatStats.blockChance,
    criticalChance: combatStats.criticalChance,
    goodsFound: combatStats.goodsFound,
    damageAgainstBeasts: combatStats.damageAgainstBeasts,
  };

  if (typeof player.refreshDerivedStats === 'function') {
    player.refreshDerivedStats();
  }
};

const coinTotal = player => player.inventory.slots
  .filter(item => item?.id === 'coins')
  .reduce((total, item) => total + Math.max(0, Number(item.qty) || 0), 0);

const spendCoins = (player, amount) => {
  let remaining = amount;
  player.inventory.slots.forEach((item) => {
    if (remaining <= 0 || item?.id !== 'coins') return;
    const available = Math.max(0, Number(item.qty) || 0);
    const spent = Math.min(available, remaining);
    item.qty = available - spent;
    remaining -= spent;
  });
  player.inventory.slots = player.inventory.slots
    .filter(item => item?.id !== 'coins' || item.qty > 0);
};

const buildBankPayload = (player) => {
  const chronicle = player?.accountId
    ? chroniclesRepository.getChronicle(player.accountId)
    : { houses: [] };
  const house = chronicle.houses.find(entry => entry.id === player?.houseId) || null;
  return {
    items: player?.bank || [],
    carriedCoins: player ? coinTotal(player) : 0,
    house: house ? {
      id: house.id,
      name: house.name,
      treasury: house.treasury,
    } : null,
  };
};

const sendPlayerMessage = (player, text) => {
  Socket.emit('game:send:message', {
    player: { socket_id: player.socket_id },
    text,
  });
};

const dropEquippedItem = (player, slotId) => {
  if (!player || !slotId || !player.wear || !player.wear[slotId]) {
    return null;
  }

  const equipped = player.wear[slotId];
  const baseItem = wearableItems.find(i => i.id === equipped.id);
  if (!baseItem || !canItemUseSlot(baseItem.slot, slotId)) {
    return null;
  }

  const item = ItemFactory.adoptExisting(equipped, { baseItem });
  const dropped = ItemFactory.toWorldInstance(item, {
    x: player.x,
    y: player.y,
  }, {
    timestamp: Date.now(),
  });

  player.wear[slotId] = null;
  refreshEquipmentStats(player);

  const scene = getPlayerScene(player);
  world.addItem(dropped, scene.id);
  broadcastSceneItems(scene, 'world:itemDropped');
  broadcastSceneItems(scene, 'item:change');
  Socket.broadcast('player:unequippedAnItem', publicPlayerProjection(player), getSceneRecipients(scene));

  return dropped;
};

const actionEvents = {
  'player:walk-here': (data) => {
    if (data.tileWalkable) {
      actionEvents['player:mouseTo']({
        data: {
          id: data.player.uuid,
          coordinates: { x: data.clickedTile.x, y: data.clickedTile.y },
          world: data.world || null,
          viewport: data.viewport || null,
          center: data.center || null,
        },
        player: {
          socket_id: data.player.uuid,
        },
      });
    }
  },
  /**
   * A player moves to a new tile via mouse
   */
  'player:mouseTo': async (data) => {
    const movingData = Object.hasOwnProperty.call(data, 'doing')
      ? data
      : data.data;
    const coordinates = movingData.coordinates || data.coordinates || { x: 0, y: 0 };
    const localX = Number.isFinite(coordinates.x) ? coordinates.x : 0;
    const localY = Number.isFinite(coordinates.y) ? coordinates.y : 0;

    const playerId = movingData.id || data.player.id;
    const playerIndexMoveTo = world.players.findIndex(
      p => p.uuid === playerId,
    );
    if (playerIndexMoveTo === -1) {
      return;
    }

    const player = world.players[playerIndexMoveTo];
    const playerTile = occupiedTile(player);

    // A dead player must not queue click-to-move; otherwise the path set while
    // awaiting respawn walks the character across the map once they revive.
    const health = player.stats && player.stats.resources && player.stats.resources.health;
    if (!health || health.current <= 0) {
      return;
    }

    const providedViewport = movingData.viewport || data.viewport;
    const providedCenter = movingData.center || data.center;
    const providedWorld = movingData.world || data.world;

    if (providedViewport
      && typeof providedViewport.x === 'number'
      && typeof providedViewport.y === 'number') {
      player.path.viewport = {
        x: providedViewport.x,
        y: providedViewport.y,
      };
    }

    if (providedCenter
      && typeof providedCenter.x === 'number'
      && typeof providedCenter.y === 'number') {
      player.path.center = {
        x: providedCenter.x,
        y: providedCenter.y,
      };
    }

    const baseViewport = player.path && player.path.viewport
      ? player.path.viewport
      : config.map.viewport;

    const baseCenter = player.path && player.path.center
      ? player.path.center
      : {
        x: Math.floor(baseViewport.x / 2),
        y: Math.floor(baseViewport.y / 2),
      };

    const targetWorld = (providedWorld
      && typeof providedWorld.x === 'number'
      && typeof providedWorld.y === 'number')
      ? providedWorld
      : {
        x: playerTile.x - baseCenter.x + localX,
        y: playerTile.y - baseCenter.y + localY,
      };

    const offsets = {
      left: Math.max(0, playerTile.x - targetWorld.x),
      right: Math.max(0, targetWorld.x - playerTile.x),
      up: Math.max(0, playerTile.y - targetWorld.y),
      down: Math.max(0, targetWorld.y - playerTile.y),
    };

    const desiredCenter = {
      x: Math.max(baseCenter.x, offsets.left),
      y: Math.max(baseCenter.y, offsets.up),
    };

    const desiredViewport = {
      x: Math.max(baseViewport.x, desiredCenter.x + offsets.right),
      y: Math.max(baseViewport.y, desiredCenter.y + offsets.down),
    };

    const matrix = await GameMap.getMatrix(player, {
      viewport: desiredViewport,
      center: desiredCenter,
    });

    const clampCoordinate = (value, max) => Math.max(0, Math.min(value, max));
    const relativeTarget = {
      x: clampCoordinate(
        targetWorld.x - (playerTile.x - matrix.center.x),
        matrix.viewport.x,
      ),
      y: clampCoordinate(
        targetWorld.y - (playerTile.y - matrix.center.y),
        matrix.viewport.y,
      ),
    };

    movingData.coordinates = relativeTarget;
    movingData.world = targetWorld;
    movingData.viewport = matrix.viewport;
    movingData.center = matrix.center;

    if (player.action && player.action.coordinates) {
      player.action.coordinates = { ...relativeTarget };
      player.action.world = { ...targetWorld };
      player.action.viewport = { ...matrix.viewport };
      player.action.center = { ...matrix.center };
    }

    if (Object.hasOwnProperty.call(data, 'doing') && player.queue.length) {
      const latestQueued = player.queue[player.queue.length - 1];
      if (latestQueued && latestQueued.actionToQueue && latestQueued.actionToQueue.coordinates) {
        latestQueued.actionToQueue.coordinates = { ...relativeTarget };
        latestQueued.actionToQueue.world = { ...targetWorld };
        latestQueued.actionToQueue.viewport = { ...matrix.viewport };
        latestQueued.actionToQueue.center = { ...matrix.center };
      }
    }

    player.path.grid = matrix.grid;
    player.path.viewport = matrix.viewport;
    player.path.center = matrix.center;
    player.path.current.walkable = true;

    const location = movingData.location || null;

    GameMap.findPath(movingData.id, relativeTarget.x, relativeTarget.y, location);
  },
  'player:examine': (data) => {
    Socket.emit('item:examine', {
      data: { type: 'normal', text: data.item.examine },
      player: {
        socket_id: data.player.socket_id,
      },
    });
  },
  'player:npc:talk': (data) => {
    const player = getPlayerFromPayload(data);
    const scene = player && getPlayerScene(player);
    const npc = scene?.npcs?.find(entry => entry.id === data.item?.id);
    const playerTile = player ? occupiedTile(player) : null;
    const nearby = npc && Math.max(
      Math.abs(playerTile.x - npc.x),
      Math.abs(playerTile.y - npc.y),
    ) <= 1;
    if (!player || scene?.type !== 'town' || !npc || npc.id !== 1 || !nearby) return;
    talkToAldwyn(player);
  },
  'player:inventory-drop': (data) => {
    const player = world.players.find(p => p.uuid === data.id) || getPlayerFromPayload(data);
    if (!player) {
      return;
    }

    const miscData = data.data?.miscData || data.data?.item?.miscData || {};
    const itemReference = {
      uuid: data.item?.uuid || data.data?.item?.uuid,
      id: data.item?.id || data.data?.item?.id,
      slot: miscData.slot,
    };
    const itemIndex = getInventoryItemIndex(player.inventory.slots, itemReference);
    const dropped = dropInventoryItem(player, itemIndex);

    if (!dropped) {
      sendInventoryError(player, 'That item is no longer in your inventory.');
      return;
    }

    console.log(
      `Dropping: ${dropped.id} (${dropped.qty || 0}) at ${player.x}, ${player.y}`,
    );
  },

  'player:inventory:commit': (incoming) => {
    const payload = incoming.data || {};
    const player = getPlayerFromPayload(incoming);

    if (!player || !player.inventory || !Array.isArray(player.inventory.slots)) {
      return;
    }

    const sourceReference = payload.item || {};
    const itemIndex = getInventoryItemIndex(player.inventory.slots, sourceReference);
    const inventoryItem = player.inventory.slots[itemIndex];

    if (!inventoryItem) {
      sendInventoryError(player, 'That item is no longer in your inventory.');
      return;
    }

    if (payload.action === 'world-drop') {
      dropInventoryItem(player, itemIndex);
      return;
    }

    if (payload.action === 'stack') {
      const targetReference = {
        uuid: payload.target?.stackTargetUuid,
        id: payload.target?.stackTargetId || inventoryItem.id,
        slot: payload.target?.stackTargetSlot,
      };
      const targetIndex = getInventoryItemIndex(player.inventory.slots, targetReference);
      const targetItem = player.inventory.slots[targetIndex];

      if (targetIndex === itemIndex || !canStackItems(inventoryItem, targetItem)) {
        sendInventoryError(player, 'Those items cannot be stacked.');
        return;
      }

      const maxStack = targetItem.maxStack || inventoryItem.maxStack || Infinity;
      const targetQty = Number.isFinite(targetItem.qty) ? targetItem.qty : 1;
      const sourceQty = Number.isFinite(inventoryItem.qty) ? inventoryItem.qty : 1;
      if (targetQty >= maxStack) {
        sendInventoryError(player, 'That stack is already full.');
        return;
      }

      const combinedQty = targetQty + sourceQty;
      targetItem.qty = Math.min(combinedQty, maxStack);

      const remainder = Math.max(0, combinedQty - maxStack);
      if (remainder > 0) {
        inventoryItem.qty = remainder;
      } else {
        player.inventory.slots.splice(itemIndex, 1);
      }

      refreshInventory(player);
      return;
    }

    if (payload.action === 'move') {
      const targetPosition = normaliseInventoryPosition(payload.target || payload);
      const requestedOrientation = payload.target?.orientation || payload.orientation || inventoryItem.orientation || 'default';
      const orientation = requestedOrientation === 'rotated' ? 'rotated' : 'default';
      const placement = canPlaceInventoryItem(
        player.inventory.slots,
        inventoryItem,
        targetPosition,
        {
          ignoreUuid: inventoryItem.uuid,
          ignoreSlot: inventoryItem.slot,
          orientation,
        },
      );

      if (!placement.valid) {
        sendInventoryError(player, 'There is no room to place that item there.');
        return;
      }

      inventoryItem.position = targetPosition;
      inventoryItem.slot = slotFromPosition(targetPosition, INVENTORY_COLUMNS);
      inventoryItem.orientation = orientation;
      refreshInventory(player);
    }
  },

  /**
   * A player equips an item from their inventory
   */
  'item:equip': async (data) => {
    // The socket dispatch hands handlers the full message; the client payload
    // lives at data.data (getPlayerFromPayload resolves the bound player).
    const player = getPlayerFromPayload(data);
    if (!player) {
      return;
    }
    // Real dispatch wraps the client payload in data.data; tolerate a flat
    // payload too (some callers/tests pass it unwrapped).
    const {
      item: itemPayload,
      miscData,
    } = resolveItemActionPayload(data);
    const getItem = wearableItems.find(i => i.id === itemPayload.id);
    if (!getItem) {
      return;
    }
    const targetSlot = itemPayload.targetSlot || miscData.targetSlot || null;
    if (targetSlot && !canItemUseSlot(getItem.slot, targetSlot)) {
      sendInventoryError(player, 'That item cannot be equipped there.');
      return;
    }
    const inventoryItem = Array.isArray(player.inventory?.slots)
      ? player.inventory.slots.find(item => (
        item
        && (
          (itemPayload.uuid && item.uuid === itemPayload.uuid)
          || (Number.isInteger(miscData.slot) && item.slot === miscData.slot && item.id === itemPayload.id)
          || (!itemPayload.uuid && item.id === itemPayload.id)
        )
      ))
      : null;
    if (!inventoryItem) {
      sendInventoryError(player, 'That item is no longer in your inventory.');
      return;
    }
    const sourceSlot = Number.isInteger(miscData.slot)
      ? miscData.slot
      : Number.isInteger(itemPayload.slot)
        ? itemPayload.slot
        : inventoryItem?.slot;
    // Resolve which physical seat this item takes (rings have two) so the
    // swap-first and the equip target the same seat.
    const wearSlot = resolveEquipSlot(player.wear, getItem.slot, targetSlot);
    // Normalise to the flat shape equippedAnItem/unequipItem expect.
    const equipData = { id: player.uuid, item: { ...itemPayload, targetSlot: wearSlot } };
    const alreadyWearing = player.wear[wearSlot];
    if (alreadyWearing) {
      const status = await pipe.player.unequipItem({
        item: {
          uuid: alreadyWearing.uuid,
          id: alreadyWearing.id,
          slot: sourceSlot,
          wearSlot,
        },
        replacingItem: {
          uuid: itemPayload.uuid,
          id: itemPayload.id,
          slot: sourceSlot,
        },
        replacing: true,
        id: player.uuid,
      });

      if (status !== 200) {
        return;
      }

      pipe.player.equippedAnItem(equipData);
    } else {
      pipe.player.equippedAnItem(equipData);
    }

    const equippedItem = player.wear[getItem.slot];
    if (equippedItem?.uuid === inventoryItem.uuid && vesselEligible(equippedItem)) {
      notifyProgression(player, 'equip-vessel');
    }
  },

  /**
   * A player unequips an item from their wear tab
   */
  'item:unequip': (data) => {
    const player = getPlayerFromPayload(data);
    const {
      payload,
      item: itemPayload,
      miscData,
    } = resolveItemActionPayload(data);
    const slotId = miscData.slot || itemPayload.slot || null;
    if (!player || !slotId || !player.wear) {
      return;
    }

    const itemUnequipping = player.wear[slotId];
    if (!itemUnequipping) {
      return;
    }

    if (miscData.action === 'world-drop' || itemPayload.action === 'world-drop') {
      dropEquippedItem(player, slotId);
      return;
    }

    const newData = {
      id: player.uuid,
      player: {
        ...(payload.player || {}),
        socket_id: player.socket_id,
      },
      item: {
        id: itemUnequipping.id,
        uuid: itemUnequipping.uuid,
        slot: slotId,
        // The physical seat to clear (e.g. ring vs ring2); slot alone is
        // ambiguous for grouped slots.
        wearSlot: slotId,
        miscData: {
          ...miscData,
          slot: slotId,
          targetInventorySlot: miscData.targetInventorySlot,
        },
      },
    };
    pipe.player.unequipItem(newData);
  },

  'player:vesselforge:add-brand': (incoming) => {
    const player = getPlayerFromPayload(incoming);
    const payload = incoming?.item ? incoming : (incoming?.data || {});
    const reference = payload.item || {};
    const scene = player && getPlayerScene(player);
    if (!player || scene?.id !== world.defaultTownId) {
      if (player) sendPlayerMessage(player, 'Brands can only be added at the Delaford forge.');
      return;
    }

    const item = player.inventory?.slots?.find(entry => (
      entry
      && reference.uuid
      && entry.uuid === reference.uuid
      && (!reference.id || entry.id === reference.id)
    ));
    if (!item?.vessel?.item) {
      sendPlayerMessage(player, 'That item cannot hold brands.');
      return;
    }
    if (coinTotal(player) < BRAND_COST) {
      sendPlayerMessage(player, `Adding a brand costs ${BRAND_COST} coins.`);
      return;
    }

    const oldVessel = item.vessel;
    const result = getForge().sear(oldVessel.item);
    if (!result.item) {
      sendPlayerMessage(player, 'That item cannot take another brand.');
      return;
    }

    const baseItem = Query.getItemData(item.id);
    const oldProjected = applyVesselCombatStats(baseItem?.stats || {}, oldVessel);
    const newVessel = {
      ...oldVessel,
      item: result.item,
      lines: vesselTooltip(result.item),
    };
    const newProjected = applyVesselCombatStats(baseItem?.stats || {}, newVessel);
    const currentAttack = item.stats?.attack || {};
    item.stats = {
      ...(item.stats || {}),
      attack: Object.fromEntries(['stab', 'slash', 'crush', 'range'].map(style => [
        style,
        (currentAttack[style] || 0)
          + ((newProjected.attack?.[style] || 0) - (oldProjected.attack?.[style] || 0)),
      ])),
    };
    item.vessel = newVessel;
    spendCoins(player, BRAND_COST);
    playerPersistence.markDirty(player);
    refreshInventory(player);
    sendPlayerMessage(player, result.event?.text?.replace(/^Seared:/, 'Brand added:') || 'Brand added.');
  },

  /**
   * Start building the context menu for the player
   */
  'player:context-menu:build': async (incomingData) => {
    const playerIndexForMenu = world.players.findIndex(
      p => p.socket_id === incomingData.data.player.socket_id,
    );

    if (playerIndexForMenu > -1) {
      const playerForMenu = world.players[playerIndexForMenu];

      if (incomingData.data.viewport
        && typeof incomingData.data.viewport.x === 'number'
        && typeof incomingData.data.viewport.y === 'number') {
        playerForMenu.path.viewport = {
          x: incomingData.data.viewport.x,
          y: incomingData.data.viewport.y,
        };
      }

      if (incomingData.data.center
        && typeof incomingData.data.center.x === 'number'
        && typeof incomingData.data.center.y === 'number') {
        playerForMenu.path.center = {
          x: incomingData.data.center.x,
          y: incomingData.data.center.y,
        };
      }
    }

    // TODO
    // Pass only socket_id and grep from
    // instead of passing whole player object
    const contextMenu = new ContextMenu(
      incomingData.data.player,
      incomingData.data.tile,
      incomingData.data.miscData,
    );

    const items = await contextMenu.build();

    rememberOfferedMenu(incomingData.data.player.socket_id, items);

    if (incomingData.data.miscData.firstOnly) {
      Socket.emit('game:context-menu:first-only', {
        data: items,
        player: incomingData.data.player,
      });
    } else {
      Socket.emit('game:context-menu:items', {
        data: items,
        player: incomingData.data.player,
      });
    }
  },
  'player:context-menu:action': (incoming) => {
    const payload = incoming?.data;
    const actionData = payload?.data;
    const item = actionData?.item;
    const selectedAction = item?.action;
    const socketId = payload?.player?.socket_id;
    if (!socketId
      || !actionData?.tile
      || !selectedAction
      || typeof selectedAction.name !== 'string'
      || typeof selectedAction.actionId !== 'string'
      || !selectedAction.actionId) {
      return;
    }

    // Never trust the echoed action: the client may only SELECT among the
    // entries this server offered for its current menu. Forged actionIds or
    // tampered item identities are dropped here instead of reaching the
    // dynamic dispatcher in Action.do (cand-003).
    const offeredItem = findOfferedMenuEntry(socketId, item);
    if (!offeredItem) {
      return;
    }

    const action = new Action(socketId, item.miscData || false);
    if (!action.player) return;
    action.do({
      tile: actionData.tile,
      item: { ...offeredItem, miscData: item.miscData },
    }, payload.queueItem);
  },

  'player:resource:goldenplaque:push': (data) => {
    const { playerIndex } = data;
    if (playerIndex === undefined || playerIndex === -1 || !world.players[playerIndex]) {
      return;
    }

    const player = world.players[playerIndex];

    // The plaque is a rare boon, not a slot machine: one push per player per
    // minute, and only when actually standing at the shrine. Without this the
    // handler was a free-item fountain reachable via crafted packets.
    const now = Date.now();
    const lastPush = goldenPlaqueCooldowns.get(player.uuid) || 0;
    if (now - lastPush < GOLDEN_PLAQUE_COOLDOWN_MS) {
      Socket.sendMessageToPlayer(playerIndex, 'The plaque is dormant. Its magic needs time to gather.');
      return;
    }

    const clickedWorld = data.todo && data.todo.actionToQueue && data.todo.actionToQueue.world;
    if (clickedWorld && !isWithinReach(player, clickedWorld)) {
      console.warn(`[actions] goldenplaque:push rejected: ${player.username} is too far from the plaque.`);
      return;
    }

    goldenPlaqueCooldowns.set(player.uuid, now);

    const { id } = UI.randomElementFromArray(wearableItems);

    const spawned = ItemFactory.toWorldInstance(
      ItemFactory.createById(id),
      { x: 20, y: 108 },
      { timestamp: Date.now() },
    );

    const scene = getPlayerScene(player);

    world.addItem(spawned, scene.id);
    broadcastSceneItems(scene, 'world:itemDropped');

    Socket.emit('game:send:message', {
      player: { socket_id: player.socket_id },
      text:
        'You feel a magical aurora as an item starts to appear from the ground...',
    });
  },

  'player:take': (data = {}) => {
    const todo = data.todo || null;
    const player = getPlayerFromPayload(data);

    if (!player) {
      return;
    }

    if (!todo || !todo.item || !todo.item.id) {
      console.warn(`[actions] player:take missing item metadata`, {
        player: player.username,
        payload: todo,
      });
      return;
    }

    if (!todo.at || typeof todo.at.x !== 'number' || typeof todo.at.y !== 'number') {
      console.warn(`[actions] player:take missing ground coordinates`, {
        player: player.username,
        payload: todo,
      });
      return;
    }

    const scene = getPlayerScene(player);
    const sceneItems = getSceneItems(scene);
    const itemToTake = sceneItems.findIndex(
      e => e
        && e.x === todo.at.x
        && e.y === todo.at.y
        && (
          (todo.item.uuid && e.uuid === todo.item.uuid)
          || (!todo.item.uuid && e.id === todo.item.id)
        ),
    );
    const worldItem = sceneItems[itemToTake];
    if (!worldItem) {
      return;
    }

    if (worldItem.boundTo && worldItem.boundTo !== player.uuid) {
      sendInventoryError(player, 'That item is bound to another adventurer.');
      return;
    }

    const playerTile = occupiedTile(player);
    const withinReach = Math.max(
      Math.abs(playerTile.x - worldItem.x),
      Math.abs(playerTile.y - worldItem.y),
    ) <= 1;
    if (!withinReach) {
      sendInventoryError(player, 'That item is too far away.');
      return;
    }

    const pickup = commitGroundItemPickup(player, scene, itemToTake);
    if (pickup.added <= 0) {
      sendInventoryError(player, 'There is no room in your backpack.');
      return;
    }

    if (worldItem.chroniclesRelic && worldItem.chroniclesRelic.id) {
      // Persist the recovered identity before closing the Chronicle entry.
      // A restart can safely requeue a still-circulating world drop.
      Promise.resolve(playerPersistence.savePlayer(player, { force: true }))
        .catch((error) => {
          console.warn(`[actions] Failed to persist recovered heirloom ${worldItem.uuid}: ${error.message}`);
        })
        .then(() => {
          const recovered = chroniclesStore.recoverRelic(
            player.uuid,
            worldItem.chroniclesRelic.id,
          );
          if (recovered.ok) {
            Socket.sendMessageToPlayer(
              player,
              `${worldItem.chroniclesRelic.scionName}'s heirloom is home once more.`,
            );
          }
        });
    }

    // Add respawn timer on item (if is a respawn)
    const sceneRespawns = getSceneRespawns(scene);
    const resetItemIndex = sceneRespawns.items.findIndex(
      i => i.respawn && i.x === todo.at.x && i.y === todo.at.y,
    );

    if (pickup.ok && resetItemIndex !== -1) {
      sceneRespawns.items[resetItemIndex].pickedUp = true;
      sceneRespawns.items[resetItemIndex].willRespawnIn = Item.calculateRespawnTime(
        sceneRespawns.items[resetItemIndex].respawnIn,
      );
    }

    notifyLootProgression(player, worldItem);
    notifyTutorial(player, 'loot');
  },

  /**
   * Grab the item under your feet (or on an adjacent tile) with one key.
   * Playtest feedback: standing ON an item made pickup harder than the
   * click-to-walk flow, because the context menu is fiddly at your own tile.
   */
  'player:take:underfoot': (data, ws) => {
    const player = world.players.find(p => ws && p.socket_id === ws.id);
    if (!player) {
      return;
    }

    const scene = getPlayerScene(player);
    const sceneItems = getSceneItems(scene);

    // Own tile first, then the four cardinal neighbours.
    const playerTile = occupiedTile(player);
    const spots = [
      playerTile,
      { x: playerTile.x + 1, y: playerTile.y },
      { x: playerTile.x - 1, y: playerTile.y },
      { x: playerTile.x, y: playerTile.y + 1 },
      { x: playerTile.x, y: playerTile.y - 1 },
    ];
    let itemIndex = -1;
    for (const spot of spots) {
      itemIndex = sceneItems.findIndex(entry => entry
        && entry.x === spot.x && entry.y === spot.y
        && (!entry.boundTo || entry.boundTo === player.uuid));
      if (itemIndex !== -1) break;
    }

    if (itemIndex === -1) {
      Socket.emit('game:send:message', {
        player: { socket_id: player.socket_id },
        text: 'There is nothing here to pick up.',
      });
      return;
    }

    const worldItem = sceneItems[itemIndex];
    const pickup = commitGroundItemPickup(player, scene, itemIndex);
    if (pickup.added <= 0) {
      sendInventoryError(player, 'There is no room in your backpack.');
      return;
    }

    const sceneRespawns = getSceneRespawns(scene);
    const respawnIndex = sceneRespawns.items.findIndex(
      entry => entry.respawn && entry.x === worldItem.x && entry.y === worldItem.y,
    );
    if (pickup.ok && respawnIndex !== -1) {
      sceneRespawns.items[respawnIndex].pickedUp = true;
      sceneRespawns.items[respawnIndex].willRespawnIn = Item.calculateRespawnTime(
        sceneRespawns.items[respawnIndex].respawnIn,
      );
    }

    notifyLootProgression(player, worldItem);
    notifyTutorial(player, 'loot');
  },

  'player:fountain:drink': (data = {}, ws = null) => {
    const player = getPlayerFromPayload(data)
      || world.players.find(candidate => candidate.socket_id === ws?.id);
    const scene = player ? getPlayerScene(player) : null;
    if (!player || scene?.type !== 'town') return;

    const playerTile = occupiedTile(player);
    const distance = Math.max(
      Math.abs(playerTile.x - MAIN_TOWN_FOUNTAIN.x),
      Math.abs(playerTile.y - MAIN_TOWN_FOUNTAIN.y),
    );
    if (distance > 1) return;

    const health = player.stats?.resources?.health;
    if (!health || health.current <= 0) return;
    const missing = Math.max(0, health.max - health.current);
    if (missing > 0 && typeof player.applyHealing === 'function') {
      player.applyHealing(missing);
      Player.broadcastStats(player);
    }

    Socket.emit('game:send:message', {
      player: { socket_id: player.socket_id },
      text: missing > 0
        ? 'You drink from the Crossroads fountain. Its cold water restores you completely.'
        : 'You drink from the Crossroads fountain. You are already at full health.',
    });
  },

  /**
   * A player wants opening a trade shop
   */
  'player:screen:shop-display': (data = {}, ws = null) => {
    const player = getPlayerFromPayload(data)
      || world.players.find(entry => entry.socket_id === ws?.id);
    const reference = data.data?.item || data.item || {};
    const shopNpcId = reference.id;
    const shopItemId = reference.shopItemId;
    const display = getReachableShopDisplay(player, { id: shopNpcId, shopItemId });
    if (!player || !display) return;

    const shop = world.shops.find(entry => entry.npcId === shopNpcId);
    if (!shop) return;
    player.currentPane = 'shop';
    player.objectId = shopNpcId;
    Socket.emit('open:screen', {
      player: { socket_id: player.socket_id },
      screen: 'shop',
      payload: shop,
    });
  },

  'player:shop-display:buy': (data = {}) => {
    const player = getPlayerFromPayload(data);
    const reference = data.item || {};
    if (!getReachableShopDisplay(player, reference)) return;
    try {
      const shop = new Shop(reference.id, player.uuid, reference.shopItemId, 'buy', 1);
      refreshShopPurchase(shop, shop.buy());
    } catch (err) {
      Socket.emit('game:send:message', {
        player: { socket_id: player.socket_id },
        text: err.message,
      });
    }
  },

  'player:shop-display:appraise': (data = {}) => {
    const player = getPlayerFromPayload(data);
    const reference = data.item || {};
    if (!getReachableShopDisplay(player, reference)) return;
    try {
      new Shop(reference.id, player.uuid, reference.shopItemId, 'value', 1).value();
    } catch (err) {
      Socket.emit('game:send:message', {
        player: { socket_id: player.socket_id },
        text: err.message,
      });
    }
  },

  'player:screen:npc:trade': (data) => {
    const player = getActionPlayer(data);
    const target = data.todo?.item;
    const clickedWorld = data.todo?.actionToQueue?.world;
    const npc = target ? getSceneNpc(player, target.id, 'trade') : null;
    const shop = npc ? world.shops.find(entry => sameIdentifier(entry.npcId, npc.id)) : null;
    if (!player || !npc || !shop || !isNearNpc(player, npc, clickedWorld)) {
      return;
    }

    openNpcPane(player, npc, 'shop', 'trade');

    Socket.emit('open:screen', {
      player: { socket_id: player.socket_id },
      screen: 'shop',
      payload: shop,
    });
  },

  'player:screen:npc:trade:action:value': (data) => {
    const player = getPlayerFromPayload(data);
    if (!player || !player.objectId || !data.item?.id
      || !isActiveNpcPane(player, 'shop', 'trade')) {
      return;
    }

    if (player.currentPane !== 'shop' || !isShopReachable(player, player.objectId)) {
      return;
    }

    const rawQty = data.item.params ? data.item.params.quantity : 0;
    const quantity = Number.isFinite(rawQty) ? Math.max(0, Math.floor(rawQty)) : 0;
    try {
      const shop = new Shop(
        player.objectId,
        player.uuid,
        data.item.id,
        'value',
        quantity,
      );
      shop.value();
    } catch (err) {
      Socket.emit('game:send:message', {
        player: { socket_id: player.socket_id },
        text: err.message,
      });
    }
  },
  /**
   * A player wants to buy or sell an item (and sometimes check its value)
   */
  'player:screen:npc:trade:action': (data) => {
    const player = getPlayerFromPayload(data);
    // Action.do dispatches { item, doing, data: { miscData } }; the socket
    // envelope wraps the same fields one level deeper under data.
    const payload = data.item ? data : (data.data || data);
    if (!player || !player.objectId || !payload.item?.id
      || !isActiveNpcPane(player, 'shop', 'trade')) {
      return;
    }

    // Validate action type before constructing the shop operation.
    const allowedShopActions = ['buy', 'sell', 'value'];
    if (!allowedShopActions.includes(payload.doing)) {
      return;
    }

    // Trading also requires the shop pane to be open and current adjacency
    // to the shopkeeper or one of its market displays (cand-004).
    if (player.currentPane !== 'shop' || !isShopReachable(player, player.objectId)) {
      return;
    }

    const rawQty = payload.item.params ? payload.item.params.quantity : 0;
    const quantity = Number.isFinite(rawQty) ? Math.max(0, Math.floor(rawQty)) : 0;
    let shop;
    let response;
    try {
      shop = new Shop(
        player.objectId,
        player.uuid,
        payload.item.id,
        payload.doing,
        quantity,
      );

      // We will be buying or selling an item
      response = shop[payload.doing]();
    } catch (err) {
      Socket.emit('game:send:message', {
        player: { socket_id: player.socket_id },
        text: err.message,
      });
      return;
    }

    /** UPDATE PLAYER DATA */
    if (Shop.successfulSale(response)) {
      world.shops[shop.shopIndex].inventory = response.shopItems;
      world.players[shop.playerIndex].inventory.slots = response.inventory;
      playerPersistence.markDirty(world.players[shop.playerIndex]);

      // Refresh client with new data
      Socket.emit('core:refresh:inventory', {
        player: { socket_id: world.players[shop.playerIndex].socket_id },
        data: response.inventory,
      });

      Socket.emit('open:screen', {
        player: { socket_id: world.players[shop.playerIndex].socket_id },
        screen: 'shop',
        payload: world.shops[shop.shopIndex],
      });
      if (response.transaction) {
        const itemName = Query.getItemData(response.transaction.itemId)?.name || response.transaction.itemId;
        const verb = response.transaction.type === 'sell' ? 'Sold' : 'Bought';
        sendPlayerMessage(
          world.players[shop.playerIndex],
          `${verb} ${response.transaction.quantity} ${itemName} for ${response.transaction.coins} coins.`,
        );
      }
    }
  },

  /**
   * A player opens a House wagon at the Crossroads. Only their own House's
   * wagon opens the pane; another House's quartermaster waves them off.
   */
  'player:screen:wagon': (data, ws = null) => {
    const player = getPlayerFromPayload(data)
      || world.players.find(entry => entry.socket_id === ws?.id);
    if (!player) return;
    const scene = getPlayerScene(player);
    const reference = data.data?.item || data.item || {};
    const wagon = scene?.npcs?.find(npc => npc.id === reference.id && String(npc.id).startsWith('wagon-'));
    const playerTile = occupiedTile(player);
    const nearby = wagon && Math.max(
      Math.abs(playerTile.x - wagon.x),
      Math.abs(playerTile.y - wagon.y),
    ) <= 2;
    if (scene?.type !== 'town' || !wagon || !nearby) return;

    if (!player.houseId || wagon.id !== wagonNpcId(player.houseId)) {
      sendPlayerMessage(player, `The quartermaster of ${wagon.name.replace(/ Wagon$/, '')} waves you off. House business only.`);
      return;
    }

    wagonService.sendWagonScreen(player);
  },

  /**
   * A player wants to access their bank
   */
  'player:screen:bank': (data) => {
    const player = getActionPlayer(data);
    const target = data.todo?.item;
    const clickedWorld = data.todo?.actionToQueue?.world;
    const npc = target ? getSceneNpc(player, target.id, 'bank') : null;
    if (!player || !npc || !isNearNpc(player, npc, clickedWorld)) {
      return;
    }

    openNpcPane(player, npc, 'bank', 'bank');

    Socket.emit('open:screen', {
      player: { socket_id: player.socket_id },
      screen: 'bank',
      payload: buildBankPayload(player),
    });
  },

  /**
   * A player withdraws or deposits items from their bank or inventory
   */
  'player:screen:bank:action': async (data) => {
    const allowedBankActions = ['deposit', 'withdraw'];
    if (!allowedBankActions.includes(data.doing)) {
      return;
    }

    const player = getPlayerFromPayload(data);
    if (!player || !data.item?.id || !isActiveNpcPane(player, 'bank', 'bank')) {
      return;
    }

    // Transfers only run with the bank pane open and the countinghouse
    // banker still adjacent - the same gate the bank-open handler enforces
    // (cand-005).
    if (player.currentPane !== 'bank' || !isBankerReachable(player)) {
      return;
    }

    try {
      const bank = new Bank(
        player.uuid,
        data.item.id,
        data.item.params?.quantity,
        data.doing,
      );
      const { inventory, bankItems } = await bank[data.doing]();

      /** UPDATE PLAYER DATA */
      world.players[bank.playerIndex].bank = bankItems;
      world.players[bank.playerIndex].inventory.slots = inventory;

      // Refresh client with new data
      Socket.emit('core:refresh:inventory', {
        player: { socket_id: world.players[bank.playerIndex].socket_id },
        data: inventory,
      });

      Socket.emit('core:bank:refresh', {
        player: { socket_id: world.players[bank.playerIndex].socket_id },
        data: bankItems,
      });
    } catch (err) {
      Socket.emit('game:send:message', {
        player: { socket_id: player.socket_id },
        text: err.message,
      });
    }
  },

  /**
   * A player is going to attempt to mine a rock
   */
};

export default actionEvents;
