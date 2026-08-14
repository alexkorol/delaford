import Query from '#server/core/data/query.js';
import Socket from '#server/socket.js';
import UI from '#shared/ui.js';
import world from '#server/core/world.js';
import ItemFactory from '#server/core/items/factory.js';
import { refreshVesselBlock } from '#server/core/items/vesselforge/adapter.js';
import {
  isInventoryCurrency,
  packInventoryItems,
  positionFromSlot,
} from '#shared/inventory-footprints.js';

const hydrateInventoryItem = (item = {}) => {
  // Persisted snapshots can be arbitrarily stale or corrupt; anything that is
  // not an object with a string id is dropped rather than resurrected.
  if (!item || typeof item !== 'object' || Array.isArray(item)
    || typeof item.id !== 'string') {
    return null;
  }

  const baseItem = Query.getItemData(item.id);
  if (!baseItem) {
    // Ids removed from the catalogue survive as inert legacy items: identity
    // and rolled data intact, but no actions the game could dispatch on.
    return { ...item, actions: Array.isArray(item.actions) ? item.actions : [] };
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
  constructor(slots, socketId, playerUuid = null) {
    const persistedSlots = Array.isArray(slots) ? slots : [];
    this.slots = packInventoryItems(persistedSlots.map(hydrateInventoryItem).filter(Boolean));
    this.socketId = socketId;
    this.playerUuid = playerUuid;
    // Player constructs its inventory before Authentication adds it to the
    // world, so this cached index is initially -1 in real sessions. Resolve
    // ownership again whenever an item enters the backpack.
    this.playerIndex = world.players.findIndex(p => p.socket_id === this.socketId);
  }

  getPlayer() {
    this.playerIndex = world.players.findIndex(p => (
      (this.playerUuid && p.uuid === this.playerUuid)
      || (this.socketId && p.socket_id === this.socketId)
    ));
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
    // Synchronous, explicit accounting (await tolerates the sync return):
    // { ok, added, remainder } is the core contract every caller can rely
    // on; requested/stacked/dropped/rejected/inventoryItems/groundItems
    // carry the full story for reward callers.
    //
    // overflow: 'reject' (default) leaves the unadded remainder with the
    // caller; overflow: 'drop' spills bound overflow at the player's feet
    // (reward grants that must never be lost).
    const baseItem = Query.getItemData(itemId) || { id: itemId };
    const stackable = !!baseItem.stackable;
    const currency = isInventoryCurrency(baseItem);
    const quantity = Number.isFinite(qty) ? Math.max(1, Math.floor(qty)) : 1;
    const rounds = stackable ? 1 : quantity; // How many times to iterate on inventory?
    const {
      existingItem = null,
      uuid: incomingUuid = null,
      rng,
      itemLevel,
      overflow = 'reject',
    } = options;
    const player = this.getPlayer();
    const playerUuid = player ? player.uuid : this.playerUuid;
    const result = {
      ok: false,
      added: 0,
      remainder: quantity,
      requested: quantity,
      stacked: 0,
      dropped: 0,
      rejected: 0,
      inventoryItems: [],
      groundItems: [],
    };
    const finish = () => {
      result.remainder = Math.max(0, result.requested - result.added);
      result.ok = result.remainder === 0 && result.dropped === 0 && result.rejected === 0
        && result.added > 0;
      return result;
    };

    if (stackable) {
      const existingStack = this.slots.find(item => item && item.id === itemId);
      if (existingStack) {
        existingStack.qty = (Number(existingStack.qty) || 1) + quantity;
        result.added = quantity;
        result.stacked = quantity;
        result.inventoryItems.push(existingStack);
        return finish();
      }

      if (currency) {
        // Currency is a carried balance, not a grid occupant: it never needs
        // a free backpack cell and never overflows.
        const balance = ItemFactory.createById(itemId, {
          uuid: incomingUuid,
          quantity,
          bindTo: playerUuid,
        }) || { ...baseItem, uuid: incomingUuid || undefined, qty: quantity };
        balance.qty = quantity;
        balance.slot = null;
        balance.position = null;
        balance.context = 'currency';
        this.slots.push(balance);
        result.added = quantity;
        result.stacked = quantity;
        result.inventoryItems.push(balance);
        return finish();
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
        const dropped = overflow === 'drop' ? this.dropOverflow(instance, player) : null;
        if (dropped) {
          result.dropped += stackable ? quantity : 1;
          result.groundItems.push(dropped);
        } else if (overflow === 'drop') {
          result.rejected += stackable ? quantity : 1;
        }
        continue;
      }

      instance.slot = openSlot;
      instance.position = positionFromSlot(openSlot);
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

    return finish();
  }
}
