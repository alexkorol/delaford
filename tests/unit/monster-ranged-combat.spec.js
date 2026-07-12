/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Monster from '#server/core/monster.js';
import Socket from '#server/socket.js';
import world from '#server/core/world.js';

const TEST_SCENES = [
  'test:ranged-attack-range',
  'test:patrol-deadlock',
];

const makeOpenMap = () => {
  const tileCount = 200 * 200;
  return {
    background: new Array(tileCount).fill(1),
    foreground: new Array(tileCount).fill(0),
  };
};

const makeMapWithWalls = (...walls) => {
  const map = makeOpenMap();
  walls.forEach(({ x, y }) => {
    // Terrain gid 32 -> zero-based tile 31, an authoritative blocked tile.
    map.background[(y * 200) + x] = 32;
  });
  return map;
};

const makeWalledMap = () => {
  const tileCount = 200 * 200;
  return {
    background: new Array(tileCount).fill(1),
    // Objects-sheet gid 253 (local id 0) is not in the walkable list
    foreground: new Array(tileCount).fill(253),
  };
};

const makeTargetPlayer = (sceneId, overrides = {}) => ({
  uuid: 'player-ranged-target',
  socket_id: 'socket-ranged-target',
  username: 'Ranged Target',
  x: 10,
  y: 10,
  sceneId,
  stats: {
    resources: {
      health: { current: 90, max: 100 },
      mana: { current: 50, max: 50 },
    },
    lifecycle: { state: 'alive' },
  },
  setAnimationState: vi.fn(),
  applyDamage: vi.fn(amount => ({ type: 'damage', amount })),
  ...overrides,
});

const makeRangedMonster = sceneId => new Monster({
  id: 'test-ranged-fiend',
  name: 'Test Archer',
  level: 1,
  archetype: 'mystic',
  rarity: 'common',
  sceneId,
  spawn: { x: 14, y: 10, radius: 0 },
  behaviour: {
    type: 'ranged',
    patrolRadius: 0,
    aggressionRange: 8,
    pursuitRange: 10,
    attack: {
      range: 5, minimumRange: 2, intervalMs: 1000, windupMs: 300,
    },
  },
  respawn: { delayMs: 100, healthFraction: 1, manaFraction: 1 },
});

describe('ranged monster combat', () => {
  beforeEach(() => {
    vi.spyOn(Socket, 'broadcast').mockImplementation(() => {});
    vi.spyOn(Socket, 'emit').mockImplementation(() => {});
    vi.spyOn(Socket, 'sendMessageToPlayer').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TEST_SCENES.forEach(sceneId => world.scenes.delete(sceneId));
  });

  it('starts an attack windup from its configured range', () => {
    const sceneId = 'test:ranged-attack-range';
    const monster = makeRangedMonster(sceneId);
    const player = makeTargetPlayer(sceneId);

    const scene = world.ensureScene(sceneId, {
      type: 'test',
      map: makeOpenMap(),
      monsters: [monster],
      metadata: { spawnPoints: [{ x: 10, y: 10 }] },
    });
    scene.players = [player];

    // Distance 4 (manhattan) — inside the 5-tile attack range
    expect(monster.tryAttack(player, 5_000)).toBe(true);
    expect(monster.state.pendingAttack).toMatchObject({ targetId: player.uuid });
  });

  it('resolves the windup and damages a target still inside range', () => {
    const sceneId = 'test:ranged-attack-range';
    const monster = makeRangedMonster(sceneId);
    const player = makeTargetPlayer(sceneId);

    const scene = world.ensureScene(sceneId, {
      type: 'test',
      map: makeOpenMap(),
      monsters: [monster],
      metadata: { spawnPoints: [{ x: 10, y: 10 }] },
    });
    scene.players = [player];

    monster.state.pendingAttack = {
      targetId: player.uuid,
      resolveAt: 5_300,
      damage: 6,
    };

    expect(monster.resolvePendingAttack(5_300)).toBe(true);
    expect(player.applyDamage).toHaveBeenCalledWith(6, expect.objectContaining({ now: 5_300 }));
    expect(player.combat.lastCombatAt).toBe(5_300);
  });

  it('misses when the target dodges away from the visible projectile endpoint', () => {
    const sceneId = 'test:ranged-attack-range';
    const monster = makeRangedMonster(sceneId);
    const player = makeTargetPlayer(sceneId);

    const scene = world.ensureScene(sceneId, {
      type: 'test',
      map: makeOpenMap(),
      monsters: [monster],
      metadata: { spawnPoints: [{ x: 10, y: 10 }] },
    });
    scene.players = [player];

    expect(monster.tryAttack(player, 5_000)).toBe(true);
    expect(Socket.broadcast).toHaveBeenCalledWith('world:projectile', expect.objectContaining({
      fromX: 14,
      fromY: 10,
      toX: 10,
      toY: 10,
    }), expect.anything());

    // Still comfortably inside the archer's five-tile range, but one tile
    // clear of the missile path and its captured visual endpoint.
    player.y = 11;

    expect(monster.resolvePendingAttack(5_300)).toBe(false);
    expect(player.applyDamage).not.toHaveBeenCalled();
  });

  it('hits when the target remains at the visible projectile endpoint', () => {
    const sceneId = 'test:ranged-attack-range';
    const monster = makeRangedMonster(sceneId);
    const player = makeTargetPlayer(sceneId);

    const scene = world.ensureScene(sceneId, {
      type: 'test',
      map: makeOpenMap(),
      monsters: [monster],
      metadata: { spawnPoints: [{ x: 10, y: 10 }] },
    });
    scene.players = [player];

    expect(monster.tryAttack(player, 5_000)).toBe(true);
    expect(monster.resolvePendingAttack(5_300)).toBeTruthy();
    expect(player.applyDamage).toHaveBeenCalled();
  });

  it('refuses to attack beyond its configured range', () => {
    const sceneId = 'test:ranged-attack-range';
    const monster = makeRangedMonster(sceneId);
    const player = makeTargetPlayer(sceneId, { x: 2, y: 10 });

    const scene = world.ensureScene(sceneId, {
      type: 'test',
      map: makeOpenMap(),
      monsters: [monster],
      metadata: { spawnPoints: [{ x: 10, y: 10 }] },
    });
    scene.players = [player];

    // Distance 12 — outside the 5-tile attack range
    expect(monster.tryAttack(player, 5_000)).toBe(false);
    expect(monster.state.pendingAttack).toBeNull();
  });

  it('refuses to fire through a wall and paths toward a clear shot', () => {
    const sceneId = 'test:ranged-attack-range';
    const monster = makeRangedMonster(sceneId);
    const player = makeTargetPlayer(sceneId);
    const scene = world.ensureScene(sceneId, {
      type: 'test',
      map: makeMapWithWalls({ x: 12, y: 10 }),
      monsters: [monster],
      metadata: { spawnPoints: [{ x: 10, y: 10 }] },
    });
    scene.players = [player];
    const pursue = vi.spyOn(monster, 'pursue').mockReturnValue(true);

    expect(monster.tryAttack(player, 5_000)).toBe(false);
    expect(monster.state.pendingAttack).toBeNull();
    expect(Socket.broadcast).not.toHaveBeenCalledWith('world:projectile', expect.anything(), expect.anything());

    monster.update(5_000);
    expect(pursue).toHaveBeenCalledWith(player, 5_000);
  });

  it('does not squeeze a diagonal shot through a blocked wall corner', () => {
    const sceneId = 'test:ranged-attack-range';
    const monster = makeRangedMonster(sceneId);
    monster.x = 12;
    monster.y = 12;
    const player = makeTargetPlayer(sceneId);
    const scene = world.ensureScene(sceneId, {
      type: 'test',
      map: makeMapWithWalls({ x: 11, y: 10 }),
      monsters: [monster],
      metadata: { spawnPoints: [{ x: 10, y: 10 }] },
    });
    scene.players = [player];

    expect(monster.hasLineOfSight(player)).toBe(false);
    expect(monster.tryAttack(player, 5_000)).toBe(false);
  });

  it('cancels damage if a wall blocks the shot during its windup', () => {
    const sceneId = 'test:ranged-attack-range';
    const monster = makeRangedMonster(sceneId);
    const player = makeTargetPlayer(sceneId);
    const map = makeOpenMap();
    const scene = world.ensureScene(sceneId, {
      type: 'test',
      map,
      monsters: [monster],
      metadata: { spawnPoints: [{ x: 10, y: 10 }] },
    });
    scene.players = [player];

    expect(monster.tryAttack(player, 5_000)).toBe(true);
    map.background[(10 * 200) + 12] = 32;

    expect(monster.resolvePendingAttack(5_300)).toBe(false);
    expect(player.applyDamage).not.toHaveBeenCalled();
  });
});

describe('patrol deadlock recovery', () => {
  beforeEach(() => {
    vi.spyOn(Socket, 'broadcast').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TEST_SCENES.forEach(sceneId => world.scenes.delete(sceneId));
  });

  it('abandons an unreachable patrol target instead of walking into walls forever', () => {
    const sceneId = 'test:patrol-deadlock';
    const monster = new Monster({
      id: 'test-patroller',
      name: 'Test Patroller',
      level: 1,
      archetype: 'brute',
      rarity: 'common',
      sceneId,
      spawn: { x: 10, y: 10, radius: 0 },
      behaviour: { patrolRadius: 4, stepIntervalMs: 200 },
      respawn: { delayMs: 100, healthFraction: 1, manaFraction: 1 },
    });

    world.ensureScene(sceneId, {
      type: 'test',
      map: makeWalledMap(),
      monsters: [monster],
      metadata: { spawnPoints: [{ x: 10, y: 10 }] },
    });

    // Outside the patrol pick range (spawn ± radius) so the repicked
    // target can never randomly equal it
    const unreachable = { x: 99, y: 99 };
    monster.state.patrolTarget = { ...unreachable };
    monster.state.lastStepAt = 0;
    monster.state.lastDecisionAt = 0;

    // Continuous movement: glide until the wall blocks the path; the target
    // must then be abandoned (cleared, with a dwell before the next wander)
    // — never an endless shuffle into the wall.
    monster.patrol(5_000); // primes the glide clock
    let abandoned = false;
    for (let now = 5_300; now <= 20_000 && !abandoned; now += 300) {
      monster.patrol(now);
      const target = monster.state.patrolTarget;
      abandoned = !target || target.x !== unreachable.x || target.y !== unreachable.y;
    }

    expect(abandoned).toBe(true);
    expect(monster.state.wanderDwellUntil || 0).toBeGreaterThan(0);
  });
});
