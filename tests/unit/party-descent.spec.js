/** @vitest-environment node */

import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('#server/core/world.js', () => {
  const players = [];
  const scenes = new Map();
  const defaultTown = {
    id: 'town-1',
    name: 'Town',
    type: 'town',
    map: { background: [], foreground: [] },
    npcs: [],
    monsters: [],
    items: [],
    metadata: {},
  };

  scenes.set('town-1', defaultTown);

  return {
    default: {
      players,
      defaultTownId: 'town-1',
      scenes,
      getScene: (id) => scenes.get(id) || null,
      getDefaultTown: () => defaultTown,
      createInstance: (partyId, data) => {
        const scene = {
          id: `instance-${partyId}`,
          type: 'instance',
          map: data.map || { background: [], foreground: [] },
          npcs: data.npcs || [],
          monsters: data.monsters || [],
          items: data.items || [],
          metadata: data.metadata || {},
        };
        scenes.set(scene.id, scene);
        return scene;
      },
      getInstance: (partyId) => scenes.get(`instance-${partyId}`) || null,
      destroyInstance: (partyId) => {
        scenes.delete(`instance-${partyId}`);
      },
      assignPlayerToScene: (player, sceneId) => {
        player.sceneId = sceneId;
      },
      getSceneForPlayer: (player) => scenes.get(player.sceneId) || defaultTown,
      getScenePlayers: (sceneId) => players.filter(p => p.sceneId === sceneId),
    },
  };
});

vi.mock('#server/socket.js', () => ({
  default: {
    emit: vi.fn(),
    broadcast: vi.fn(),
  },
}));

vi.mock('#server/core/entities/player/stats-manager.js', () => ({
  broadcastStats: vi.fn(),
  default: vi.fn(),
}));

vi.mock('#server/core/map.js', () => ({
  LAYOUT_IDS: ['warren', 'clearings', 'gauntlet'],
  default: {
    generateInstance: vi.fn().mockImplementation(async (options = {}) => {
      const depth = options.depth || 1;
      return {
        map: { background: [], foreground: [] },
        npcs: [],
        monsters: [{ id: `floor-${depth}-monster` }],
        items: [],
        respawns: { items: [], monsters: [], resources: [] },
        metadata: {
          seed: (options.seed || 0) + (depth * 1000),
          baseSeed: options.seed || 0,
          depth,
          template: options.template || 'dungeon',
          theme: 'stone',
          spawnPoints: [{ x: 5, y: 6 }],
          stairsUp: { x: 5, y: 5 },
          stairsDown: { x: 9, y: 9 },
          rewards: {},
        },
      };
    }),
  },
}));

vi.mock('#server/core/monster.js', () => ({
  default: class MockMonster {
    constructor(def) {
      this.id = def.id || 'mock-monster';
      this.uuid = `uuid-${this.id}`;
      this.isAlive = true;
      this.toJSON = () => ({ id: this.id, uuid: this.uuid });
    }
  },
}));

vi.mock('#shared/ui.js', () => ({
  default: {
    getLevel: exp => (exp >= 100 ? 2 : 1),
    capitalizeFirstLetter: text => `${text.charAt(0).toUpperCase()}${text.slice(1)}`,
  },
}));

const { partyService } = await import('#server/player/handlers/party.js');
const { default: GameMap } = await import('#server/core/map.js');
const { default: Socket } = await import('#server/socket.js');
const { broadcastStats } = await import('#server/core/entities/player/stats-manager.js');
const { default: world } = await import('#server/core/world.js');

const PartyService = partyService.constructor;

const makePlayer = (overrides = {}) => ({
  uuid: `player-${Math.random().toString(36).slice(2, 8)}`,
  username: `Player${Math.floor(Math.random() * 1000)}`,
  socket_id: `ws-${Math.random().toString(36).slice(2, 8)}`,
  sceneId: 'town-1',
  x: 7,
  y: 5,
  path: { grid: null },
  ...overrides,
});

const flushAsync = () => new Promise((resolve) => { setImmediate(resolve); });

describe('party dungeon descent', () => {
  let service;
  let leader;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PartyService();
    leader = makePlayer({ username: 'Leader' });
    world.players.length = 0;
    world.players.push(leader);
  });

  it('startInstance enters floor 1 with a base seed', async () => {
    const party = service.createParty(leader);
    await service.startInstance(party, leader);

    expect(party.state).toBe('instance');
    expect(party.metadata.depth).toBe(1);
    expect(party.metadata.baseSeed).toBeTruthy();
    expect(leader.x).toBe(5);
    expect(leader.y).toBe(6);
    expect(GameMap.generateInstance).toHaveBeenCalledWith(
      expect.objectContaining({ depth: 1, seed: party.metadata.baseSeed }),
    );
  });

  it('descends to a deeper floor when a member stands on the stairs down', async () => {
    const party = service.createParty(leader);
    await service.startInstance(party, leader);

    leader.x = 9;
    leader.y = 9;
    service.checkStairTransitions();
    await flushAsync();

    expect(party.metadata.depth).toBe(2);
    expect(party.state).toBe('instance');
    // members are teleported to the new floor's spawn point, off the stairs
    expect(leader.x).toBe(5);
    expect(leader.y).toBe(6);
    expect(GameMap.generateInstance).toHaveBeenLastCalledWith(
      expect.objectContaining({ depth: 2, seed: party.metadata.baseSeed }),
    );
  });

  it('climbs back up one floor from the entry stairs on deep floors', async () => {
    const party = service.createParty(leader);
    await service.startInstance(party, leader);
    await service.transitionFloor(party, 3);
    expect(party.metadata.depth).toBe(3);

    leader.x = 5;
    leader.y = 5;
    service.checkStairTransitions();
    await flushAsync();

    expect(party.metadata.depth).toBe(2);
    expect(party.state).toBe('instance');
  });

  it('returns to town from the floor 1 entry stairs', async () => {
    const party = service.createParty(leader);
    await service.startInstance(party, leader);

    leader.x = 5;
    leader.y = 5;
    service.checkStairTransitions();
    await flushAsync();

    expect(party.state).toBe('lobby');
    expect(party.metadata.depth).toBe(0);
    expect(party.metadata.baseSeed).toBeNull();
    expect(leader.sceneId).toBe('town-1');
    expect(world.getInstance(party.id)).toBeNull();
  });

  it('completing a floor distributes rewards but keeps the party inside', async () => {
    const party = service.createParty(leader);
    await service.startInstance(party, leader);
    const scene = world.getInstance(party.id);

    const completed = await service.completeInstance(party, { scene });

    expect(completed).toBe(true);
    expect(party.state).toBe('instance');
    expect(party.metadata.completedAt).toBeTruthy();
    expect(leader.sceneId).toBe(`instance-${party.id}`);

    // descending resets completion so the next floor can complete again
    await service.transitionFloor(party, 2);
    expect(party.metadata.completedAt).toBeNull();
  });

  it('routes instance experience rewards through skill and character level progression', async () => {
    leader.skills = {
      attack: { level: 1, exp: 90 },
      defence: { level: 1, exp: 0 },
    };
    leader.level = 1;
    leader.stats = {
      resources: {
        health: { current: 12, max: 50 },
        mana: { current: 4, max: 30 },
      },
    };
    leader.refreshDerivedStats = vi.fn(() => {
      leader.stats.resources.health.max = 70;
      leader.stats.resources.mana.max = 45;
    });

    const party = service.createParty(leader);
    await service.startInstance(party, leader);
    const scene = world.getInstance(party.id);

    const completed = await service.completeInstance(party, {
      scene,
      rewards: {
        experience: { skill: 'attack', amount: 15 },
      },
    });

    expect(completed).toBe(true);
    expect(leader.skills.attack).toMatchObject({ exp: 105, level: 2 });
    expect(leader.level).toBe(2);
    expect(leader.refreshDerivedStats).toHaveBeenCalled();
    expect(leader.stats.resources.health.current).toBe(70);
    expect(leader.stats.resources.mana.current).toBe(45);
    expect(Socket.emit).toHaveBeenCalledWith('resource:skills:update', expect.objectContaining({
      player: { socket_id: leader.socket_id },
      data: leader.skills,
    }));
    expect(broadcastStats).toHaveBeenCalledWith(leader);
    expect(Socket.emit).toHaveBeenCalledWith('party:instance:complete', expect.objectContaining({
      rewards: [expect.objectContaining({
        uuid: leader.uuid,
        experience: expect.objectContaining({
          skill: 'attack',
          amount: 15,
          level: 2,
          levelledUp: true,
          characterLevelledUp: true,
        }),
      })],
    }));
  });

  it('ignores stair checks while a transition is already running', async () => {
    const party = service.createParty(leader);
    await service.startInstance(party, leader);

    party.metadata.transitioning = true;
    leader.x = 9;
    leader.y = 9;
    service.checkStairTransitions();
    await flushAsync();

    expect(party.metadata.depth).toBe(1);
  });
});
