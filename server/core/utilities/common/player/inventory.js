import Query from '#server/core/data/query.js';
import UI from '#shared/ui.js';
import world from '#server/core/world.js';
import ItemFactory from '#server/core/items/factory.js';
import { packInventoryItems, positionFromSlot } from '#shared/inventory-footprints.js';

const hydrateInventoryItem = (item = {}) => {
  if (!item || !item.id) {
    return item;
  }

  const baseItem = Query.getItemData(item.id);
  if (!baseItem) {
    return item;
  }

  const equipSlot = item.equipSlot
    || item.slotType
    || (typeof baseItem.slot === 'string' ? baseItem.slot : null);

  return {
    ...baseItem,
    ...item,
    name: item.name || item.displayName || baseItem.name,
    displayName: item.displayName || item.name || baseItem.name,
    graphics: item.graphics || baseItem.graphics,
    stats: item.stats || baseItem.stats,
    actions: item.actions || baseItem.actions,
    ...(equipSlot ? { equipSlot, slotType: equipSlot } : {}),
  };
};

export default class Inventory {
  constructor(slots, socketId, playerUuid = null) {
    this.slots = packInventoryItems((slots || []).map(hydrateInventoryItem));
    this.socketId = socketId;
    this.playerUuid = playerUuid;
  }

  getPlayer() {
    return world.players.find(player => (
      (this.playerUuid && player.uuid === this.playerUuid)
      || (this.socketId && player.socket_id === this.socketId)
    )) || null;
  }

  /**
   * Adds item to player's inventory
   *
   * @param {string} itemId - The ID of the item
   * @param {integer} qty - The number of quantity for that item
   */
  add(itemId, qty = 1, options = {}) {
    const requested = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0;
    if (!itemId || requested === 0) {
      return { ok: false, added: 0, remainder: requested };
    }

    const baseItem = Query.getItemData(itemId) || { id: itemId };
    const stackable = !!baseItem.stackable;
    const { existingItem = null, uuid: incomingUuid = null } = options;
    const player = this.getPlayer();
    const playerUuid = player ? player.uuid : this.playerUuid;
    let remainder = requested;

    if (stackable) {
      this.slots
        .filter(item => item && item.id === itemId && item.stackable)
        .forEach((item) => {
          if (remainder <= 0) {
            return;
          }

          const currentQty = Number.isFinite(item.qty) ? item.qty : 1;
          const maxStack = Number.isFinite(item.maxStack)
            ? item.maxStack
            : Number.isFinite(baseItem.maxStack) ? baseItem.maxStack : Infinity;
          const capacity = Math.max(0, maxStack - currentQty);
          const transfer = Math.min(capacity, remainder);
          item.qty = currentQty + transfer;
          remainder -= transfer;
        });
    }

    while (remainder > 0) {
      const openSlot = UI.getOpenSlot(this.slots, 'inventory', baseItem);
      if (openSlot === false && openSlot !== 0) {
        break;
      }

      const configuredMaxStack = Number.isFinite(baseItem.maxStack)
        ? baseItem.maxStack
        : Number.isFinite(existingItem?.maxStack) ? existingItem.maxStack : Infinity;
      const maxStack = stackable ? configuredMaxStack : Infinity;
      const quantity = stackable ? Math.min(remainder, maxStack) : 1;
      let instance = null;

      if (existingItem && remainder === requested && quantity === remainder) {
        instance = ItemFactory.adoptExisting(existingItem, {
          uuid: incomingUuid,
          quantity,
          bindTo: playerUuid,
          baseItem,
        });
      } else {
        instance = ItemFactory.createById(itemId, {
          uuid: remainder === requested ? incomingUuid : null,
          quantity,
          bindTo: playerUuid,
        });
      }

      if (!instance) {
        break;
      }

      instance.slot = openSlot;
      instance.position = positionFromSlot(openSlot);
      instance.context = 'item';
      if (stackable) {
        instance.qty = quantity;
      }
      this.slots.push(instance);
      remainder -= quantity;
    }

    return {
      ok: remainder === 0,
      added: requested - remainder,
      remainder,
    };
  }
}
