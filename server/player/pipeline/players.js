import Socket from '#server/socket.js';
import { wearableItems } from '#server/core/data/items/index.js';
import world from '#server/core/world.js';
import Wear from '#server/core/utilities/wear.js';
import ItemFactory from '#server/core/items/factory.js';
import {
  INVENTORY_COLUMNS,
  canPlaceInventoryItem,
  findOpenInventorySlot,
  positionFromSlot,
} from '#shared/inventory-footprints.js';

const findInventoryItemIndex = (slots = [], reference = {}) => {
  if (reference.uuid) {
    const uuidIndex = slots.findIndex(item => item && item.uuid === reference.uuid);
    if (uuidIndex !== -1) {
      return uuidIndex;
    }
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

const sendInventoryMessage = (player, text) => {
  if (!player || !player.socket_id) {
    return;
  }

  Socket.emit('game:send:message', {
    player: { socket_id: player.socket_id },
    text,
  });
};

const isNumericSlot = slot => Number.isInteger(slot) && slot >= 0;

const resolveRequestedInventorySlot = (data = {}) => {
  const item = data.item || {};
  const miscData = item.miscData || {};
  const candidates = [
    item.targetInventorySlot,
    miscData.targetInventorySlot,
    data.targetInventorySlot,
    data.target && data.target.slot,
  ];

  const slot = candidates.find(isNumericSlot);
  return isNumericSlot(slot) ? slot : null;
};

export default {
  /**
   * Equip an an item to the player
   *
   * @param {object} data Item you are equipping
   */
  equippedAnItem(data) {
    const playerIndex = world.players.findIndex(p => p.uuid === data.id);
    if (playerIndex === -1) {
      return;
    }
    const player = world.players[playerIndex];
    const itemReference = {
      uuid: data.item.uuid,
      id: data.item.id,
      slot: data.item.miscData?.slot,
    };
    const inventoryIndex = findInventoryItemIndex(player.inventory.slots, itemReference);
    const equippingItem = player.inventory.slots[inventoryIndex];
    const baseItem = wearableItems.find(i => i.id === data.item.id) || equippingItem;

    if (!equippingItem || !baseItem) {
      return;
    }

    const wearItem = ItemFactory.adoptExisting(equippingItem, { baseItem });
    wearItem.graphics = equippingItem.graphics || baseItem.graphics;
    wearItem.name = equippingItem.name || baseItem.name;
    wearItem.id = equippingItem.id || baseItem.id;
    wearItem.slotType = baseItem.slot;

    player.wear[baseItem.slot] = wearItem;

    if (inventoryIndex > -1) {
      player.inventory.slots.splice(inventoryIndex, 1);
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
    Socket.broadcast(
      'player:equippedAnItem',
      player,
      world.getScenePlayers(player.sceneId),
    );
  },

  /**
   * Unequip an an item to the player
   *
   * @param {object} data Item you are unequipping
   */
  unequipItem(data) {
    return new Promise((resolve) => {
      const playerIndex = world.players.findIndex(p => p.uuid === data.id);
      if (playerIndex === -1) {
        resolve(400);
        return;
      }
      const player = world.players[playerIndex];
      const baseItem = wearableItems.find(i => i.id === data.item.id);

      if (!baseItem) {
        resolve(400);
        return;
      }

      const equipped = player.wear[baseItem.slot];
      if (!equipped) {
        resolve(400);
        return;
      }

      const inventoryItem = ItemFactory.adoptExisting(equipped, { baseItem });
      inventoryItem.context = 'item';

      const sourceSlot = isNumericSlot(data.item.slot) ? data.item.slot : null;
      const requestedInventorySlot = resolveRequestedInventorySlot(data);
      const replacingReference = data.replacingItem || {};
      let targetSlot = false;

      if (requestedInventorySlot !== null && !data.replacing) {
        const requestedPosition = positionFromSlot(requestedInventorySlot, INVENTORY_COLUMNS);
        const placement = canPlaceInventoryItem(
          player.inventory.slots,
          inventoryItem,
          requestedPosition,
        );

        if (!placement.valid) {
          sendInventoryMessage(player, 'There is no room to place that item there.');
          resolve(409);
          return;
        }

        targetSlot = requestedInventorySlot;
      }

      if (targetSlot === false && data.replacing && sourceSlot !== null) {
        const sourcePosition = positionFromSlot(sourceSlot, INVENTORY_COLUMNS);
        const placement = canPlaceInventoryItem(
          player.inventory.slots,
          inventoryItem,
          sourcePosition,
          {
            ignoreUuid: replacingReference.uuid,
            ignoreSlot: sourceSlot,
          },
        );

        if (placement.valid) {
          targetSlot = sourceSlot;
        }
      }

      if (targetSlot === false) {
        targetSlot = findOpenInventorySlot(player.inventory.slots, inventoryItem);
      }

      if (targetSlot === false || targetSlot === null || typeof targetSlot === 'undefined') {
        sendInventoryMessage(player, 'You need more room in your backpack before unequipping that.');
        resolve(409);
        return;
      }

      inventoryItem.slot = targetSlot;
      inventoryItem.position = positionFromSlot(targetSlot, INVENTORY_COLUMNS);

      player.inventory.slots.push(inventoryItem);

      player.wear[baseItem.slot] = null;

      const combatStats = Wear.updateCombat(playerIndex);
      player.combat = {
        ...player.combat,
        attack: combatStats.attack,
        defense: combatStats.defense,
      };

      if (typeof player.refreshDerivedStats === 'function') {
        player.refreshDerivedStats();
      }

      Socket.broadcast(
        'player:unequippedAnItem',
        player,
        world.getScenePlayers(player.sceneId),
      );
      resolve(200);
    });
  },
};
