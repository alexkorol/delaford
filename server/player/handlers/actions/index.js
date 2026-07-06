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
import Map from '#server/core/map.js';
import Player from '#server/core/player.js';
import Wear from '#server/core/utilities/wear.js';
import Mining from '#server/core/skills/mining.js';
import Smithing from '#server/core/skills/smithing.js';
import Query from '#server/core/data/query.js';
import Socket from '#server/socket.js';
import UI from '#shared/ui.js';
import {
  INVENTORY_COLUMNS,
  canPlaceInventoryItem,
  positionFromSlot,
  slotFromPosition,
} from '#shared/inventory-footprints.js';
import pipe from '#server/player/pipeline/index.js';
import ItemFactory from '#server/core/items/factory.js';
import world from '#server/core/world.js';
import { notifyTutorial } from '#server/core/tutorial.js';

const refreshInventory = (player) => {
  if (!player || !player.socket_id) {
    return;
  }

  Socket.emit('core:refresh:inventory', {
    player: { socket_id: player.socket_id },
    data: player.inventory.slots,
  });
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
  const socketId = payload.player?.socket_id || incoming.player?.socket_id;
  const playerId = payload.id || incoming.id || payload.player?.uuid || incoming.player?.uuid;

  return world.players.find((player) => (
    (playerId && player.uuid === playerId)
    || (socketId && player.socket_id === socketId)
  ));
};

const getPlayerScene = player => (
  world.getSceneForPlayer(player) || world.getDefaultTown()
);

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
  };

  if (typeof player.refreshDerivedStats === 'function') {
    player.refreshDerivedStats();
  }
};

const dropEquippedItem = (player, slotId) => {
  if (!player || !slotId || !player.wear || !player.wear[slotId]) {
    return null;
  }

  const equipped = player.wear[slotId];
  const baseItem = wearableItems.find(i => i.id === equipped.id);
  if (!baseItem || baseItem.slot !== slotId) {
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
  Socket.broadcast('player:unequippedAnItem', player);

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
        x: player.x - baseCenter.x + localX,
        y: player.y - baseCenter.y + localY,
      };

    const offsets = {
      left: Math.max(0, player.x - targetWorld.x),
      right: Math.max(0, targetWorld.x - player.x),
      up: Math.max(0, player.y - targetWorld.y),
      down: Math.max(0, targetWorld.y - player.y),
    };

    const desiredCenter = {
      x: Math.max(baseCenter.x, offsets.left),
      y: Math.max(baseCenter.y, offsets.up),
    };

    const desiredViewport = {
      x: Math.max(baseViewport.x, desiredCenter.x + offsets.right),
      y: Math.max(baseViewport.y, desiredCenter.y + offsets.down),
    };

    const matrix = await Map.getMatrix(player, {
      viewport: desiredViewport,
      center: desiredCenter,
    });

    const clampCoordinate = (value, max) => Math.max(0, Math.min(value, max));
    const relativeTarget = {
      x: clampCoordinate(
        targetWorld.x - (player.x - matrix.center.x),
        matrix.viewport.x,
      ),
      y: clampCoordinate(
        targetWorld.y - (player.y - matrix.center.y),
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

    Map.findPath(movingData.id, relativeTarget.x, relativeTarget.y, location);
  },
  'player:examine': (data) => {
    Socket.emit('item:examine', {
      data: { type: 'normal', text: data.item.examine },
      player: {
        socket_id: data.player.socket_id,
      },
    });
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
    const payload = data.data || data;
    const itemPayload = payload.item || {};
    const miscData = itemPayload.miscData || {};
    const getItem = wearableItems.find(i => i.id === itemPayload.id);
    if (!getItem) {
      return;
    }
    const targetSlot = itemPayload.targetSlot || miscData.targetSlot || null;
    if (targetSlot && targetSlot !== getItem.slot) {
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
    // Normalise to the flat shape equippedAnItem/unequipItem expect.
    const equipData = { id: player.uuid, item: itemPayload };
    const alreadyWearing = player.wear[getItem.slot];
    if (alreadyWearing) {
      const status = await pipe.player.unequipItem({
        item: {
          uuid: alreadyWearing.uuid,
          id: alreadyWearing.id,
          slot: sourceSlot,
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
  },

  /**
   * A player unequips an item from their wear tab
   */
  'item:unequip': (data) => {
    const player = getPlayerFromPayload(data);
    const payload = data.data || data;
    const itemPayload = payload.item || {};
    const miscData = itemPayload.miscData || {};
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
        miscData: {
          ...miscData,
          slot: slotId,
          targetInventorySlot: miscData.targetInventorySlot,
        },
      },
    };
    pipe.player.unequipItem(newData);
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
    const miscData = incoming.data.data.item.miscData || false;
    const action = new Action(incoming.data.player.socket_id, miscData);
    action.do(incoming.data.data, incoming.data.queueItem);
  },

  'player:resource:smelt:anvil:action': (data) => {
    // Forge bar to item (weapon/shield/armor)
    // Check for smithing level and return appropriate response
    const playerIndex = world.players.findIndex(
      player => player.uuid === data.player.uuid,
    );
    if (playerIndex === -1) {
      return;
    }
    const itemClickedOn = data.player.currentPaneData[data.data.miscData.slot];

    const smith = new Smithing(playerIndex, itemClickedOn, 'forge');
    const { player } = data;
    smith.forge(player.inventory.slots);

    // Update the experience
    smith.updateExperience(itemClickedOn.expGained);

    // Tell client of their new experience in that skill
    Socket.emit('resource:skills:update', {
      player: { socket_id: world.players[playerIndex].socket_id },
      data: world.players[playerIndex].skills,
    });
  },
  'player:resource:smelt:furnace:action': async (data) => {
    const itemClickedOn = data.player.currentPaneData[data.data.miscData.slot];
    const playerIndex = world.players.findIndex(
      player => player.uuid === data.player.uuid,
    );
    if (playerIndex === -1) {
      return;
    }
    const smithing = new Smithing(playerIndex, itemClickedOn, 'smelt');
    const smithingLevelToSmelt = Smithing.bars();

    const { player } = data;

    if (player.skills.smithing.level >= smithingLevelToSmelt[itemClickedOn]) {
      const barSmelted = await smithing.smelt(player.inventory.slots);

      if (barSmelted) {
        smithing.updateExperience(barSmelted.experience);

        Socket.emit('resource:skills:update', {
          player: { socket_id: world.players[playerIndex].socket_id },
          data: world.players[playerIndex].skills,
        });
      }
    } else {
      Socket.sendMessageToPlayer(
        playerIndex,
        'You need a higher smithing level.',
      );
    }
  },

  'player:resource:smelt:furnace:pane': (data) => {
    if (data.playerIndex === undefined) {
      data.playerIndex = world.players.findIndex(p => p.uuid === data.player.uuid);
      data.todo = data;
    }
    const { playerIndex } = data;
    if (playerIndex === -1 || !world.players[playerIndex]) {
      return;
    }
    const player = world.players[playerIndex];
    world.players[data.playerIndex].currentPane = 'furnace';

    // TODO
    // Can definitely be abstracted out to something
    // such as "Panes" with items that show on different panes
    // that come with different requirements (ie: furnace view, cooking, smithing, etc.)
    const itemsToReturn = Object.keys(Smithing.bars());

    // Sometimes whats on the pane needs to travel
    // with the screen because its not being tracked in
    // the world object. So we need to pass the items to player.
    world.players[data.playerIndex].currentPaneData = itemsToReturn;

    Socket.emit('open:screen', {
      player: { socket_id: world.players[data.playerIndex].socket_id },
      screen: 'furnace',
      payload: {
        smithingLevel: player.skills.smithing.level,
        items: itemsToReturn,
      },
    });
  },

  'player:resource:smith:anvil:pane': (data) => {
    if (data.playerIndex === undefined) {
      data.playerIndex = world.players.findIndex(p => p.uuid === data.player.uuid);
      data.todo = data;
    }
    const { playerIndex } = data;
    if (playerIndex === -1 || !world.players[playerIndex]) {
      return;
    }
    const player = world.players[playerIndex];
    world.players[data.playerIndex].currentPane = 'anvil';

    const getBars = player.inventory.slots.filter(item => item.id.includes('-bar'));
    const getHammer = player.inventory.slots.filter(
      item => item.id === 'hammer',
    );

    const hasRequiredTools = () => getBars.length > 0 && getHammer.length > 0;
    if (hasRequiredTools()) {
      const barToSmith = getBars ? getBars[0] : null;
      const bar = barToSmith.id.split('-')[0];
      const itemsToReturn = Smithing.getItemsToSmith(barToSmith.id);

      Socket.emit('open:screen', {
        player: { socket_id: world.players[data.playerIndex].socket_id },
        screen: 'anvil',
        payload: {
          bar,
          smithingLevel: player.skills.smithing.level,
          items: itemsToReturn,
        },
      });

      // Sometimes whats on the pane needs to travel
      // with the screen because its not being tracked in
      // the world object. So we need to pass the items to player.
      world.players[data.playerIndex].currentPaneData = itemsToReturn;
    } else if (!getBars || getBars.length === 0) {
      Socket.sendMessageToPlayer(playerIndex, 'You need bars to smelt.');
    } else if (!getHammer || getHammer.length === 0) {
      Socket.sendMessageToPlayer(
        playerIndex,
        'You need a hammer to smith bars on an anvil.',
      );
    }
  },

  'player:resource:goldenplaque:push': (data) => {
    const { playerIndex } = data;
    if (playerIndex === undefined || playerIndex === -1 || !world.players[playerIndex]) {
      return;
    }

    const { id } = UI.randomElementFromArray(wearableItems);

    const spawned = ItemFactory.toWorldInstance(
      ItemFactory.createById(id),
      { x: 20, y: 108 },
      { timestamp: Date.now() },
    );

    const player = world.players[playerIndex];
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
    const { playerIndex } = data;
    const todo = data.todo || null;
    const player = world.players[playerIndex];

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

    const baseData = Query.getItemData(todo.item.id) || {};
    const itemId = baseData.id || todo.item.id;

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
      Socket.sendMessageToPlayer(
        playerIndex,
        'That item is bound to another adventurer.',
      );
      return;
    }

    const candidateInventoryItem = ItemFactory.adoptExisting(worldItem, { baseItem: baseData })
      || { ...baseData, ...worldItem };
    const openSlot = UI.getOpenSlot(player.inventory.slots, 'inventory', candidateInventoryItem);
    if (openSlot === false && openSlot !== 0) {
      sendInventoryError(player, 'There is no room in your backpack.');
      return;
    }

    // If qty not specified, we are picking up 1 item.
    const quantity = worldItem.qty || 1;
    sceneItems.splice(itemToTake, 1);

    broadcastSceneItems(scene, 'item:change');

    const itemUuidLabel = todo.item.uuid ? `${todo.item.uuid.substr(0, 5)}...` : 'no-uuid';
    console.log(`Picking up: ${todo.item.id} (${itemUuidLabel})`);

    world.players[playerIndex].inventory.add(itemId, quantity, {
      uuid: todo.item.uuid,
      existingItem: worldItem,
    });

    // Add respawn timer on item (if is a respawn)
    const sceneRespawns = getSceneRespawns(scene);
    const resetItemIndex = sceneRespawns.items.findIndex(
      i => i.respawn && i.x === todo.at.x && i.y === todo.at.y,
    );

    if (resetItemIndex !== -1) {
      sceneRespawns.items[resetItemIndex].pickedUp = true;
      sceneRespawns.items[resetItemIndex].willRespawnIn = Item.calculateRespawnTime(
        sceneRespawns.items[resetItemIndex].respawnIn,
      );
    }

    // Tell client to update their inventory
    Socket.emit('core:refresh:inventory', {
      player: { socket_id: world.players[playerIndex].socket_id },
      data: world.players[playerIndex].inventory.slots,
    });

    notifyTutorial(world.players[playerIndex], 'loot');
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
    const spots = [
      { x: player.x, y: player.y },
      { x: player.x + 1, y: player.y },
      { x: player.x - 1, y: player.y },
      { x: player.x, y: player.y + 1 },
      { x: player.x, y: player.y - 1 },
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
    const baseData = Query.getItemData(worldItem.id) || {};
    const candidate = ItemFactory.adoptExisting(worldItem, { baseItem: baseData })
      || { ...baseData, ...worldItem };
    const openSlot = UI.getOpenSlot(player.inventory.slots, 'inventory', candidate);
    if (openSlot === false && openSlot !== 0) {
      sendInventoryError(player, 'There is no room in your backpack.');
      return;
    }

    const quantity = worldItem.qty || 1;
    sceneItems.splice(itemIndex, 1);
    broadcastSceneItems(scene, 'item:change');

    player.inventory.add(baseData.id || worldItem.id, quantity, {
      uuid: worldItem.uuid,
      existingItem: worldItem,
    });

    const sceneRespawns = getSceneRespawns(scene);
    const respawnIndex = sceneRespawns.items.findIndex(
      entry => entry.respawn && entry.x === worldItem.x && entry.y === worldItem.y,
    );
    if (respawnIndex !== -1) {
      sceneRespawns.items[respawnIndex].pickedUp = true;
      sceneRespawns.items[respawnIndex].willRespawnIn = Item.calculateRespawnTime(
        sceneRespawns.items[respawnIndex].respawnIn,
      );
    }

    refreshInventory(player);
    notifyTutorial(player, 'loot');
  },

  /**
   * A player wants opening a trade shop
   */
  'player:screen:npc:trade': (data) => {
    if (data.playerIndex === undefined) {
      data.playerIndex = world.players.findIndex(p => p.uuid === data.player.uuid);
      data.todo = data;
    }
    if (data.playerIndex === -1 || !world.players[data.playerIndex]) {
      return;
    }
    console.log('Accessing trade shop...', data.todo.item.id);
    world.players[data.playerIndex].currentPane = 'shop';
    world.players[data.playerIndex].objectId = data.todo.item.id;

    Socket.emit('open:screen', {
      player: { socket_id: world.players[data.playerIndex].socket_id },
      screen: 'shop',
      payload: world.shops.find(e => e.npcId === data.todo.item.id),
    });
  },

  'player:screen:npc:trade:action:value': (data) => {
    const player = getPlayerFromPayload(data);
    if (!player || !player.objectId || !data.item?.id) {
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
    if (!player || !player.objectId || !data.item?.id) {
      return;
    }

    // Validate action type before constructing the shop operation.
    const allowedShopActions = ['buy', 'sell', 'value'];
    if (!allowedShopActions.includes(data.doing)) {
      return;
    }

    const rawQty = data.item.params ? data.item.params.quantity : 0;
    const quantity = Number.isFinite(rawQty) ? Math.max(0, Math.floor(rawQty)) : 0;
    let shop;
    let response;
    try {
      shop = new Shop(
        player.objectId,
        player.uuid,
        data.item.id,
        data.doing,
        quantity,
      );

      // We will be buying or selling an item
      response = shop[data.doing]();
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
    }
  },

  'player:screen:smelt': (data) => {
    if (data.playerIndex === undefined) {
      data.playerIndex = world.players.findIndex(p => p.uuid === data.player.uuid);
      data.todo = data;
    }
    if (data.playerIndex === -1 || !world.players[data.playerIndex]) {
      return;
    }
    world.players[data.playerIndex].currentPane = 'smelt';

    Socket.emit('open:screen', {
      player: { socket_id: world.players[data.playerIndex].socket_id },
      screen: 'smelt',
      payload: { items: world.players[data.playerIndex].skills.smithing.level },
    });
  },

  /**
   * A player wants to access their bank
   */
  'player:screen:bank': (data) => {
    if (data.playerIndex === undefined) {
      data.playerIndex = world.players.findIndex(p => p.uuid === data.player.uuid);
      data.todo = data;
    }
    if (data.playerIndex === -1 || !world.players[data.playerIndex]) {
      return;
    }
    world.players[data.playerIndex].currentPane = 'bank';

    Socket.emit('open:screen', {
      player: { socket_id: world.players[data.playerIndex].socket_id },
      screen: 'bank',
      payload: { items: world.players[data.playerIndex].bank },
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
    if (!player || !data.item?.id) {
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
  'player:resource:mining:rock': async (data) => {
    const mining = new Mining(data.playerIndex, data.todo.item.id);

    try {
      const rockMined = await mining.pickAtRock();

      // Tell user of successful resource gathering
      Socket.sendMessageToPlayer(
        data.playerIndex,
        `You successfully mined some ${rockMined.name}.`,
      );

      // Extract resource and either add to inventory or drop it
      mining.extractResource(rockMined);

      const player = world.players[data.playerIndex];
      const activeScene = player
        ? world.getSceneForPlayer(player)
        : world.getDefaultTown();
      const scene = activeScene || world.getDefaultTown();
      const mapLayers = scene && scene.map ? scene.map : world.map;
      if (mapLayers && Array.isArray(mapLayers.foreground)) {
        mapLayers.foreground[data.todo.actionToQueue.onTile] = 532;
      }

      // Update the experience
      mining.updateExperience(rockMined.experience);

      // Tell client of their new experience in that skill
      Socket.emit('resource:skills:update', {
        player: { socket_id: world.players[data.playerIndex].socket_id },
        data: world.players[data.playerIndex].skills,
      });

      // Update client of dead rock
      Socket.broadcast(
        'world:foreground:update',
        mapLayers && Array.isArray(mapLayers.foreground)
          ? mapLayers.foreground
          : world.map.foreground,
        world.getScenePlayers(scene.id),
      );

      // Add this resource to respawn clock
      if (!scene.respawns) {
        scene.respawns = {
          items: [],
          monsters: [],
          resources: [],
        };
      } else if (!Array.isArray(scene.respawns.resources)) {
        scene.respawns.resources = [];
      }

      scene.respawns.resources.push({
        sceneId: scene.id,
        setToTile: rockMined.id + 253,
        onTile: data.todo.actionToQueue.onTile,
        willRespawnIn: Item.calculateRespawnTime(rockMined.respawnIn),
      });
    } catch (err) {
      // Tell player of their error
      // either no pickaxe or no rock available
      Socket.sendMessageToPlayer(data.playerIndex, err.message);
    }
  },
};

export default actionEvents;
