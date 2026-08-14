/** @vitest-environment node */

import { afterEach, describe, expect, it } from 'vitest';

import Inventory from '#server/core/utilities/common/player/inventory.js';
import world from '#server/core/world.js';

const resetPlayers = () => {
  world._players = [];
  world.getDefaultTown().players = [];
};

const attachInventory = (inventory, overrides = {}) => {
  const player = {
    uuid: 'inventory-player',
    socket_id: 'inventory-socket',
    inventory,
    ...overrides,
  };
  world.addPlayer(player);
  return player;
};

describe('server inventory additions', () => {
  afterEach(() => resetPlayers());

  it('resolves its owner by stable identity after player construction', () => {
    const inventory = new Inventory([], 'inventory-socket', 'inventory-player');
    const player = attachInventory(inventory);

    expect(inventory.getPlayer()).toBe(player);
  });

  it('merges currency into an existing stack even when every slot is occupied', () => {
    const fillers = Array.from({ length: 84 }, (_, index) => ({
      id: `filler-${index}`,
      uuid: `filler-${index}`,
      slot: index,
      size: { width: 1, height: 1 },
    }));
    const inventory = new Inventory([
      { id: 'coins', uuid: 'coin-stack', slot: null, qty: 100 },
      ...fillers,
    ], 'inventory-socket', 'inventory-player');
    attachInventory(inventory);

    const result = inventory.add('coins', 37);

    expect(result).toEqual({ ok: true, added: 37, remainder: 0 });
    expect(inventory.slots).toHaveLength(85);
    expect(inventory.slots.find(item => item.uuid === 'coin-stack').qty).toBe(137);
  });

  it('creates a carried-gold balance without requiring a free backpack cell', () => {
    const fillers = Array.from({ length: 84 }, (_, index) => ({
      id: `filler-${index}`,
      uuid: `filler-${index}`,
      slot: index,
      size: { width: 1, height: 1 },
    }));
    const inventory = new Inventory(fillers, 'inventory-socket', 'inventory-player');
    attachInventory(inventory);

    expect(inventory.add('coins', 37)).toEqual({ ok: true, added: 37, remainder: 0 });
    expect(inventory.slots.find(item => item.id === 'coins')).toMatchObject({
      qty: 37,
      slot: null,
      position: null,
      context: 'currency',
    });
  });

  it('returns the unadded remainder instead of silently losing a full-bag item', () => {
    const fillers = Array.from({ length: 84 }, (_, index) => ({
      id: `filler-${index}`,
      uuid: `filler-${index}`,
      slot: index,
      size: { width: 1, height: 1 },
    }));
    const inventory = new Inventory(fillers, 'inventory-socket', 'inventory-player');
    attachInventory(inventory);

    expect(inventory.add('bronze-sword', 1)).toEqual({
      ok: false,
      added: 0,
      remainder: 1,
    });
    expect(inventory.slots).toHaveLength(84);
  });

  it('binds newly added equipment to the owning player', () => {
    const inventory = new Inventory([], 'inventory-socket', 'inventory-player');
    attachInventory(inventory);

    const result = inventory.add('bronze-sword', 1);
    const sword = inventory.slots.find(item => item.id === 'bronze-sword');

    expect(result.ok).toBe(true);
    expect(sword.boundTo).toBe('inventory-player');
  });
});
