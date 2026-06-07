import Query from '#server/core/data/query.js';
import UI from '#shared/ui.js';
import world from '#server/core/world.js';
import ItemFactory from '#server/core/items/factory.js';
import { packInventoryItems } from '#shared/inventory-footprints.js';

const hydrateInventoryItem = (item = {}) => {
  if (!item || !item.id) {
    return item;
  }

  const baseItem = Query.getItemData(item.id);
  if (!baseItem) {
    return item;
  }

  return {
    ...baseItem,
    ...item,
    name: item.name || item.displayName || baseItem.name,
    displayName: item.displayName || item.name || baseItem.name,
    graphics: item.graphics || baseItem.graphics,
    stats: item.stats || baseItem.stats,
    actions: item.actions || baseItem.actions,
  };
};

export default class Inventory {
  constructor(slots, socketId) {
    this.slots = packInventoryItems((slots || []).map(hydrateInventoryItem));
    this.socketId = socketId;
    this.playerIndex = world.players.findIndex(p => p.socket_id === this.socketId);
  }

  /**
   * Adds item to player's inventory
   *
   * @param {string} itemId - The ID of the item
   * @param {integer} qty - The number of quantity for that item
   */
  add(itemId, qty = 1, options = {}) {
    // TODO
    // Drop items on floor if no space (functionality in shop)
    return new Promise((resolve) => {
      const baseItem = Query.getItemData(itemId) || { id: itemId };
      const stackable = !!baseItem.stackable;
      const rounds = stackable ? 1 : qty; // How many times to iterate on inventory?
      const { existingItem = null, uuid: incomingUuid = null } = options;
      const player = world.players[this.playerIndex];
      const playerUuid = player ? player.uuid : null;

      for (let index = 0; index < rounds; index += 1) {
        const openSlot = UI.getOpenSlot(this.slots, 'inventory', baseItem);
        if (openSlot === false && openSlot !== 0) {
          continue;
        }

        let instance = null;

        if (existingItem) {
          instance = ItemFactory.adoptExisting(existingItem, {
            uuid: incomingUuid,
            quantity: stackable ? qty : existingItem.qty || 1,
            bindTo: playerUuid,
            baseItem,
          });
        } else {
          instance = ItemFactory.createById(itemId, {
            uuid: incomingUuid,
            quantity: stackable ? qty : 1,
            bindTo: playerUuid,
          });
        }

        if (!instance) {
          continue;
        }

        instance.slot = openSlot;
        instance.context = 'item';

        if (stackable) {
          instance.qty = qty;
        }

        this.slots.push(instance);
      }

      resolve(200);
    });
  }
}
