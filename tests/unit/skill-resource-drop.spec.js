/** @vitest-environment node */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import Socket from '#server/socket.js';
import Skill from '#server/core/skills/index.js';
import world from '#server/core/world.js';
import UI from '#shared/ui.js';

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

const makePlayer = () => ({
  uuid: 'player-1',
  socket_id: 'socket-1',
  x: 12,
  y: 14,
  inventory: {
    slots: [],
    add: vi.fn(),
  },
  skills: {},
});

describe('Skill.extractResource scene drops', () => {
  beforeEach(() => {
    resetWorld();
    vi.spyOn(Socket, 'broadcast').mockImplementation(() => {});
    vi.spyOn(Socket, 'emit').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetWorld();
  });

  it('drops mined resources into the player active scene when inventory is full', () => {
    const scene = world.ensureScene('zone:mining-overflow-test', {
      map: { foreground: [], background: [] },
      items: [],
      respawns: { items: [], monsters: [], resources: [] },
    });
    const player = makePlayer();
    world.addPlayer(player, scene.id);
    vi.spyOn(UI, 'getOpenSlot').mockReturnValue(false);

    const skill = new Skill(0);
    skill.extractResource({
      id: 280,
      resources: 'copper-ore',
    });

    expect(scene.items).toHaveLength(1);
    expect(scene.items[0]).toMatchObject({
      id: 'copper-ore',
      x: player.x,
      y: player.y,
    });
    expect(world.items).toEqual([]);
    expect(player.inventory.add).not.toHaveBeenCalled();
    expect(Socket.broadcast).toHaveBeenCalledWith('world:itemDropped', scene.items, [player]);
  });
});
