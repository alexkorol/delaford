import Query from '#server/core/data/query.js';
import Socket from '#server/socket.js';
import UI from '#shared/ui.js';
import world from '#server/core/world.js';
import ItemFactory from '#server/core/items/factory.js';
import { refreshVesselBlock } from '#server/core/items/vesselforge/adapter.js';
import { packInventoryItems } from '#shared/inventory-footprints.js';

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
  const refreshedVessel = item.vessel?.item ? refreshVesselBlock(item.vessel) : null;

  return {
    ...baseItem,
    ...item,
    name: item.name || item.displayName || baseItem.name,
    displayName: item.displayName || item.name || baseItem.name,
    graphics: baseItem.graphics?.tileset === 'vessels'
      ? baseItem.graphics
      : item.graphics || baseItem.graphics,
    stats: item.stats || baseItem.stats,
    actions: item.actions || baseItem.actions,
    ...(refreshedVessel ? {
      vessel: refreshedVessel,
      ...(refreshedVessel.combat?.modifiers
        ? { combatBonuses: refreshedVessel.combat.modifiers }
        : {}),
    } : {}),
    ...(equipSlot ? { equipSlot, slotType: equipSlot } : {}),
  };
};

export default class Inventory {
  constructor(slots, socketId) {
    this.slots = packInventoryItems((slots || []).map(hydrateInventoryItem));
    this.socketId = socketId;
    // Player constructs its inventory before Authentication adds it to the
    // world, so this cached index is initially -1 in real sessions. Resolve
    // ownership again whenever an item enters the backpack.
    this.playerIndex = world.players.findIndex(p => p.socket_id === this.socketId);
  }

  getPlayer() {
    this.playerIndex = world.players.findIndex(p => p.socket_id === this.socketId);
    return this.playerIndex === -1 ? null : world.players[this.playerIndex];
  }

  dropOverflow(instance, player) {
    if (!instance || !player) {
      return null;
    }

    const scene = world.getSceneForPlayer(player) || world.getDefaultTown();
    if (!scene) {
      return null;
    }

    const dropped = ItemFactory.toWorldInstance(instance, {
      x: player.x,
      y: player.y,
    }, { timestamp: Date.now() });

    return world.addItem(dropped, scene.id);
  }

  /**
   * Adds item to player's inventory
   *
   * @param {string} itemId - The ID of the item
   * @param {integer} qty - The number of quantity for that item
   */
  add(itemId, qty = 1, options = {}) {
    // Return an explicit accounting result so reward callers can distinguish
    // inventory additions, merged currency, recoverable drops, and rejection.
    return new Promise((resolve) => {
      const baseItem = Query.getItemData(itemId) || { id: itemId };
      const stackable = !!baseItem.stackable;
      const quantity = Number.isFinite(qty) ? Math.max(1, Math.floor(qty)) : 1;
      const rounds = stackable ? 1 : quantity; // How many times to iterate on inventory?
      const {
        existingItem = null,
        uuid: incomingUuid = null,
        rng,
        itemLevel,
      } = options;
      const player = this.getPlayer();
      const playerUuid = player ? player.uuid : null;
      const result = {
        requested: quantity,
        added: 0,
        stacked: 0,
        dropped: 0,
        rejected: 0,
        inventoryItems: [],
        groundItems: [],
      };

      if (stackable) {
        const existingStack = this.slots.find(item => item && item.id === itemId);
        if (existingStack) {
          existingStack.qty = (Number(existingStack.qty) || 1) + quantity;
          result.added = quantity;
          result.stacked = quantity;
          result.inventoryItems.push(existingStack);
          resolve(result);
          return;
        }
      }

      for (let index = 0; index < rounds; index += 1) {
        let instance = null;

        if (existingItem && index === 0) {
          instance = ItemFactory.adoptExisting(existingItem, {
            uuid: incomingUuid,
            quantity: stackable ? quantity : existingItem.qty || 1,
            bindTo: playerUuid,
            baseItem,
          });
        } else {
          instance = ItemFactory.createById(itemId, {
            uuid: incomingUuid,
            quantity: stackable ? qty : 1,
            bindTo: playerUuid,
            rng,
            itemLevel,
          });
        }

        if (!instance) {
          result.rejected += stackable ? quantity : 1;
          continue;
        }

        const openSlot = UI.getOpenSlot(this.slots, 'inventory', instance);
        if (openSlot === false && openSlot !== 0) {
          const dropped = this.dropOverflow(instance, player);
          if (dropped) {
            result.dropped += stackable ? quantity : 1;
            result.groundItems.push(dropped);
          } else {
            result.rejected += stackable ? quantity : 1;
          }
          continue;
        }

        instance.slot = openSlot;
        instance.context = 'item';

        if (stackable) {
          instance.qty = quantity;
        }

        this.slots.push(instance);
        result.added += stackable ? quantity : 1;
        result.inventoryItems.push(instance);
      }

      if (result.groundItems.length && player) {
        const scene = world.getSceneForPlayer(player) || world.getDefaultTown();
        Socket.broadcast('world:itemDropped', scene.items, world.getScenePlayers(scene.id));
        Socket.emit('game:send:message', {
          player: { socket_id: player.socket_id },
          text: `Your backpack is full. ${result.dropped} item${result.dropped === 1 ? '' : 's'} fell at your feet.`,
        });
      }

      resolve(result);
    });
  }
}
