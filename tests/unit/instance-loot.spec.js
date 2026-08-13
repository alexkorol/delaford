/** @vitest-environment node */

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('#server/core/world.js', () => {
  const scenes = new Map();
  return {
    default: {
      players: [],
      npcs: [],
      items: [],
      map: { background: [], foreground: [] },
      scenes,
      defaultTownId: 'town-1',
      getScene: id => scenes.get(id) || null,
      getScenePlayers: () => [],
    },
  };
});

vi.mock('#server/socket.js', () => ({
  default: {
    emit: vi.fn(),
    broadcast: vi.fn(),
    sendMessageToPlayer: vi.fn(),
  },
}));

const { default: GameMap } = await import('#server/core/map.js');
const { dropMonsterLoot, GEAR_DROP_POOL } = await import('#server/core/combat/loot.js');
const { default: world } = await import('#server/core/world.js');
const { default: Socket } = await import('#server/socket.js');
const { default: UI } = await import('#shared/ui.js');
const { default: chroniclesStore } = await import('#server/core/services/chronicles-store.js');

const makeRngQueue = (values) => {
  const queue = [...values];
  return () => (queue.length ? queue.shift() : 0.99);
};

describe('instance treasure generation', () => {
  it('places a treasure room with loot on open tiles', async () => {
    const floor = await GameMap.generateInstance({ seed: 1717, template: 'dungeon' });
    const { metadata, items, map } = floor;
    const width = 200;

    expect(metadata.treasureRoom).toBeTruthy();
    expect(items.length).toBeGreaterThanOrEqual(1);

    const coins = items.find(item => item.id === 'coins');
    expect(coins).toBeTruthy();
    expect(coins.qty).toBeGreaterThan(0);

    items.forEach((item) => {
      const index = (item.y * width) + item.x;
      expect(UI.tileWalkable(map.background[index] - 1)).toBe(true);
      const fg = map.foreground[index];
      expect(!fg || UI.tileWalkable(fg - 1, 'foreground')).toBe(true);
    });
  });

  it('guards the stairs down with an elite boss', async () => {
    const floor = await GameMap.generateInstance({ seed: 1717, template: 'tomb' });
    const { metadata, monsters } = floor;

    const boss = monsters.find(monster => monster.rarity === 'elite');
    expect(boss).toBeTruthy();
    expect(boss.spawn.x).toBe(metadata.stairsDown.x);
    expect(boss.spawn.y).toBe(metadata.stairsDown.y);
    expect(boss.rewards.experience).toBeGreaterThan(monsters[0].rewards.experience);
  });

  it('names monsters after the floor theme', async () => {
    const crypt = await GameMap.generateInstance({ seed: 42, template: 'tomb' });
    const names = new Set(crypt.monsters.map(monster => monster.name));

    const cryptNames = ['Risen Blademaster', 'Gravebolt Archer', 'Bone Chorister', 'The Pale Sovereign'];
    names.forEach((name) => {
      expect(cryptNames).toContain(name);
    });
  });

  it('spawns at least one monster per non-entry room, with packs allowed', async () => {
    const floor = await GameMap.generateInstance({ seed: 555, template: 'dungeon' });
    const roomCount = floor.metadata.roomCentres.length;

    expect(floor.monsters.length).toBeGreaterThanOrEqual(roomCount - 1);
  });
});

describe('monster loot drops', () => {
  const makeSlainMonster = (sceneId, overrides = {}) => ({
    uuid: 'monster-slain',
    name: 'Loot Fiend',
    x: 12,
    y: 14,
    sceneId,
    rarityId: 'common',
    rewards: { experience: 30, coins: 45 },
    ...overrides,
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('always drops the coin bounty into the scene', () => {
    const sceneId = 'scene-loot-1';
    const scene = { id: sceneId, items: [], players: [] };
    world.scenes.set(sceneId, scene);

    const drops = dropMonsterLoot(makeSlainMonster(sceneId), { rng: makeRngQueue([0.99]) });

    expect(drops).toHaveLength(1);
    expect(drops[0].id).toBe('coins');
    expect(drops[0].qty).toBe(45);
    expect(drops[0].x).toBe(12);
    expect(drops[0].y).toBe(14);
    expect(scene.items).toContain(drops[0]);
    expect(Socket.broadcast).toHaveBeenCalledWith('world:itemDropped', scene.items, []);
  });

  it('drops gear when the rarity-gated roll succeeds', () => {
    const sceneId = 'scene-loot-2';
    const scene = { id: sceneId, items: [], players: [] };
    world.scenes.set(sceneId, scene);

    const monster = makeSlainMonster(sceneId, { rarityId: 'elite' });
    const drops = dropMonsterLoot(monster, { rng: makeRngQueue([0.01, 0]) });

    expect(drops).toHaveLength(2);
    expect(GEAR_DROP_POOL).toContain(drops[1].id);
    expect(drops[1].uuid).toBeTruthy();
  });

  it('returns a queued House heirloom from an elite with exact identity', () => {
    const sceneId = 'scene-relic-drop';
    const scene = { id: sceneId, items: [], players: [] };
    world.scenes.set(sceneId, scene);
    const item = {
      id: 'bronze-sword',
      uuid: 'fallen-heirloom-1',
      name: 'Verdant Bronze Sword',
      displayName: 'Verdant Bronze Sword',
      type: 'weapon',
      boundTo: 'account-1',
      affixes: { brand: { id: 'verdant' }, bond: null },
      vessel: { ilvl: 7, rarity: 'uncommon' },
      stats: { attack: { slash: 8 } },
      chroniclesRelic: { id: 'fallen-heirloom-1', scionName: 'Morrow' },
    };
    vi.spyOn(chroniclesStore, 'beginRelicDrop').mockReturnValue({
      ok: true,
      relic: { id: item.uuid, status: 'circulating', item },
      fallen: { name: 'Morrow' },
    });
    const player = {
      uuid: 'account-1',
      socket_id: 'socket-1',
      chronicles: { houseId: 'house-1', scionId: 'scion-successor' },
    };

    const drops = dropMonsterLoot(
      makeSlainMonster(sceneId, { rarityId: 'elite', rewards: {} }),
      { player, rng: makeRngQueue([0.99]) },
    );

    expect(chroniclesStore.beginRelicDrop).toHaveBeenCalledWith('account-1', player.chronicles);
    expect(drops).toHaveLength(1);
    expect(drops[0]).toMatchObject({
      id: item.id,
      uuid: item.uuid,
      name: item.name,
      boundTo: 'account-1',
      affixes: item.affixes,
      vessel: item.vessel,
      stats: item.stats,
      chroniclesRelic: item.chroniclesRelic,
    });
  });

  it('drops nothing without a scene or rewards', () => {
    const noScene = dropMonsterLoot(makeSlainMonster('scene-missing'));
    expect(noScene).toHaveLength(0);

    const sceneId = 'scene-loot-3';
    world.scenes.set(sceneId, { id: sceneId, items: [], players: [] });
    const noRewards = dropMonsterLoot(
      makeSlainMonster(sceneId, { rewards: {} }),
      { rng: makeRngQueue([0.99]) },
    );
    expect(noRewards).toHaveLength(0);
  });
});
