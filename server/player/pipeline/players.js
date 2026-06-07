import Socket from '#server/socket.js';
import UI from '#shared/ui.js';
import { wearableItems } from '#server/core/data/items/index.js';
import world from '#server/core/world.js';
import Wear from '#server/core/utilities/wear.js';
import ItemFactory from '#server/core/items/factory.js';

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
    const equippingItem = player.inventory.slots.find(s => s.slot === data.item.miscData.slot);
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

    const inventoryIndex = player.inventory.slots.findIndex(i => i.uuid === wearItem.uuid);
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
    Socket.broadcast('player:equippedAnItem', player);
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

      const slot = UI.getOpenSlot(player.inventory.slots, 'inventory', equipped);
      const targetSlot = (data.replacing && UI.isNumeric(slot) && slot >= data.item.slot)
        ? data.item.slot
        : slot;

      const inventoryItem = ItemFactory.adoptExisting(equipped, { baseItem });
      inventoryItem.slot = targetSlot;
      inventoryItem.context = 'item';

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

      Socket.broadcast('player:unequippedAnItem', player);
      resolve(200);
    });
  },
};
