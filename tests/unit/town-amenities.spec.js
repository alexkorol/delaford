/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Socket from '#server/socket.js';
import world from '#server/core/world.js';
import actionEvents from '#server/player/handlers/actions/index.js';
import { autoPickupCurrency } from '#server/core/items/pickup.js';

const resetWorld = () => {
  world.players.splice(0, world.players.length);
  const town = world.getDefaultTown();
  town.players = [];
  town.items = [];
  town.type = 'town';
};

describe('town amenities', () => {
  beforeEach(() => {
    resetWorld();
    vi.spyOn(Socket, 'emit').mockImplementation(() => {});
    vi.spyOn(Socket, 'broadcast').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetWorld();
  });

  it('automatically commits nearby gold but leaves equipment on the floor', () => {
    const player = {
      uuid: 'scion-auto-gold',
      socket_id: 'socket-auto-gold',
      x: 10,
      y: 10,
      inventory: {
        slots: [{ id: 'coins', qty: 100 }],
        add: vi.fn((_id, qty) => ({ ok: true, added: qty, remainder: 0 })),
      },
    };
    world.addPlayer(player);
    world.items = [
      { id: 'coins', uuid: 'gold-drop', qty: 12, x: 11, y: 10 },
      { id: 'bronze-sword', uuid: 'sword-drop', x: 10, y: 10 },
    ];

    expect(autoPickupCurrency(player)).toBe(12);
    expect(world.items.map(item => item.id)).toEqual(['bronze-sword']);
    expect(player.inventory.add).toHaveBeenCalledWith('coins', 12, expect.objectContaining({
      uuid: 'gold-drop',
    }));
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      text: 'Picked up 12 gold.',
    }));
  });

  it('restores a living scion at the Crossroads fountain', () => {
    const player = {
      uuid: 'scion-fountain',
      socket_id: 'socket-fountain',
      sceneId: world.defaultTownId,
      x: 39,
      y: 115,
      stats: { resources: { health: { current: 7, max: 20 } } },
      applyHealing: vi.fn((amount) => {
        player.stats.resources.health.current += amount;
      }),
    };
    world.addPlayer(player);

    actionEvents['player:fountain:drink']({}, { id: player.socket_id });

    expect(player.applyHealing).toHaveBeenCalledWith(13);
    expect(player.stats.resources.health.current).toBe(20);
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      text: expect.stringContaining('restores you completely'),
    }));
  });
});
