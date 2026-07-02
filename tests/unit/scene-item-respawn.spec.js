/** @vitest-environment node */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import Item from '#server/core/item.js';
import Socket from '#server/socket.js';
import world from '#server/core/world.js';

const resetWorld = () => {
  const town = world.getDefaultTown();
  world._players = [];
  world.clients = [];
  town.players = [];
  town.items = [];
  town.respawns = {
    items: [],
    monsters: [],
    resources: [],
  };
  Array.from(world.scenes.keys())
    .filter(sceneId => sceneId !== world.defaultTownId)
    .forEach(sceneId => world.scenes.delete(sceneId));
  world.instances.clear();
};

describe('scene item respawns', () => {
  beforeEach(() => {
    resetWorld();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    vi.spyOn(Socket, 'broadcast').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetWorld();
  });

  it('respawns picked-up items into their scene instead of default town', () => {
    const scene = world.ensureScene('zone:item-respawn-test', {
      map: { foreground: [], background: [] },
      items: [],
      respawns: {
        items: [{
          id: 'coins',
          x: 4,
          y: 6,
          respawn: true,
          pickedUp: true,
          respawnIn: '5s',
          willRespawnIn: new Date('2025-12-31T23:59:55Z'),
        }],
        monsters: [],
        resources: [],
      },
    });
    const player = {
      uuid: 'player-1',
      socket_id: 'socket-1',
    };
    world.addPlayer(player, scene.id);
    world.items = [{
      id: 'coins',
      uuid: 'town-coins',
      x: 4,
      y: 6,
      respawn: true,
    }];

    Item.check();

    expect(scene.items).toHaveLength(1);
    expect(scene.items[0]).toMatchObject({
      id: 'coins',
      x: 4,
      y: 6,
      respawn: true,
      respawnIn: '5s',
    });
    expect(world.items).toHaveLength(1);
    expect(world.items[0].uuid).toBe('town-coins');
    expect(Socket.broadcast).toHaveBeenCalledWith('world:itemDropped', scene.items, [player]);
  });
});
