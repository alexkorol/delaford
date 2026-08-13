/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Combat from '#server/core/combat/index.js';
import Monster from '#server/core/monster.js';
import Socket from '#server/socket.js';
import world from '#server/core/world.js';

const makeMonster = () => new Monster({
  id: 'lifecycle-fiend',
  name: 'Lifecycle Fiend',
  level: 1,
  archetype: 'brute',
  rarity: 'common',
  spawn: { x: 10, y: 10, radius: 0 },
  behaviour: { patrolRadius: 0 },
  respawn: { delayMs: 100, healthFraction: 1, manaFraction: 1 },
});

const makeBehaviourMonster = behaviourType => new Monster({
  id: `lifecycle-${behaviourType}`,
  name: `${behaviourType} lifecycle fiend`,
  level: 1,
  archetype: behaviourType === 'support' ? 'mystic' : 'brute',
  rarity: 'common',
  spawn: { x: 10, y: 10, radius: 0 },
  behaviour: {
    type: behaviourType,
    patrolRadius: 0,
    attack: { range: behaviourType === 'melee' ? 1 : 5, minimumRange: 1 },
  },
  respawn: { delayMs: 100, healthFraction: 1, manaFraction: 1 },
});

const makeOpenMap = () => {
  const tileCount = 200 * 200;
  return {
    background: new Array(tileCount).fill(1),
    foreground: new Array(tileCount).fill(0),
  };
};

describe('monster lifecycle', () => {
  beforeEach(() => {
    vi.spyOn(Socket, 'broadcast').mockImplementation(() => {});
    vi.spyOn(Socket, 'emit').mockImplementation(() => {});
    vi.spyOn(Socket, 'sendMessageToPlayer').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    [
      'test:melee-monster-ai-lifecycle',
      'test:ranged-monster-ai-lifecycle',
      'test:support-monster-ai-lifecycle',
      'test:monster-lifecycle-combat',
      'test:monster-stoneguard-mitigation',
      'test:monster-frost-slow',
      'test:monster-player-collision',
      'test:monster-monster-collision',
    ].forEach(sceneId => world.scenes.delete(sceneId));
  });

  it('normalises creature tags and exposes them to clients', () => {
    const monster = new Monster({
      id: 'tagged-wolf',
      name: 'Tagged Wolf',
      tags: [' Beast ', 'beast', '', null],
    });

    expect(monster.tags).toEqual(['beast']);
    expect(monster.toJSON().tags).toEqual(['beast']);
  });

  it('dies immediately on lethal damage instead of consuming player cheat-death state', () => {
    const monster = makeMonster();

    expect(monster.isAlive).toBe(true);
    expect(monster.stats.resources.health.current).toBe(monster.stats.resources.health.max);

    const result = monster.takeDamage(monster.stats.resources.health.max + 100, { now: 1_000 });

    expect(result.type).toBe('death');
    expect(monster.isAlive).toBe(false);
    expect(monster.stats.resources.health.current).toBe(0);
    expect(monster.stats.lifecycle.state).toBe('awaiting-respawn');
    expect(monster.stats.lifecycle.respawn.at).toBe(1_100);
    expect(monster.stats.lifecycle.cheatDeath.charges).toBe(0);
    expect(monster.state.respawnAt).toBe(1_100);
  });

  it('can die again after respawning', () => {
    const monster = makeMonster();

    const firstDeath = monster.takeDamage(monster.stats.resources.health.max + 100, { now: 1_000 });
    expect(firstDeath.type).toBe('death');

    monster.respawnNow(1_200);

    expect(monster.isAlive).toBe(true);
    expect(monster.stats.lifecycle.state).toBe('alive');
    expect(monster.stats.lifecycle.respawn.pending).toBe(false);
    expect(monster.stats.lifecycle.respawn.at).toBeNull();

    const secondDeath = monster.takeDamage(monster.stats.resources.health.max + 100, { now: 1_300 });

    expect(secondDeath.type).toBe('death');
    expect(monster.isAlive).toBe(false);
    expect(monster.stats.resources.health.current).toBe(0);
    expect(monster.stats.lifecycle.state).toBe('awaiting-respawn');
    expect(monster.state.respawnAt).toBe(1_400);
  });

  it('ignores stale damage while already waiting to respawn', () => {
    const monster = makeMonster();

    const firstDeath = monster.takeDamage(monster.stats.resources.health.max + 100, { now: 1_000 });
    expect(firstDeath.type).toBe('death');
    expect(monster.stats.lifecycle.deaths).toBe(1);
    expect(monster.state.respawnAt).toBe(1_100);

    const staleHit = monster.takeDamage(10, { now: 1_050 });

    expect(staleHit).toBeNull();
    expect(monster.stats.lifecycle.deaths).toBe(1);
    expect(monster.stats.lifecycle.respawn.at).toBe(1_100);
    expect(monster.state.respawnAt).toBe(1_100);
  });

  it.each(['melee', 'ranged', 'support'])('respawns %s monsters through AI update and allows another death', (behaviourType) => {
    const sceneId = `test:${behaviourType}-monster-ai-lifecycle`;
    const monster = makeBehaviourMonster(behaviourType);
    monster.sceneId = sceneId;
    world.ensureScene(sceneId, {
      type: 'test',
      map: { background: [], foreground: [] },
      monsters: [monster],
      metadata: { spawnPoints: [{ x: 10, y: 10 }] },
    });

    const firstDeath = monster.takeDamage(monster.stats.resources.health.max + 100, { now: 1_000 });
    expect(firstDeath.type).toBe('death');
    expect(monster.isAlive).toBe(false);

    expect(monster.update(1_099)).toBe(false);
    expect(monster.isAlive).toBe(false);

    expect(monster.update(1_100)).toBe(true);
    expect(monster.isAlive).toBe(true);
    expect(monster.stats.lifecycle.state).toBe('alive');
    expect(monster.stats.lifecycle.respawn.pending).toBe(false);
    expect(monster.state.respawnAt).toBeNull();
    expect(monster.x).toBe(monster.spawn.x);
    expect(monster.y).toBe(monster.spawn.y);

    const secondDeath = monster.takeDamage(monster.stats.resources.health.max + 100, { now: 1_200 });
    expect(secondDeath.type).toBe('death');
    expect(monster.isAlive).toBe(false);
    expect(monster.stats.lifecycle.deaths).toBe(2);
    expect(monster.state.respawnAt).toBe(1_300);
  });

  it('can be killed, respawned, and killed again through player combat', () => {
    const sceneId = 'test:monster-lifecycle-combat';
    const player = {
      uuid: 'player-lifecycle',
      socket_id: 'socket-lifecycle',
      username: 'Lifecycle Tester',
      x: 10,
      y: 10,
      facing: 'right',
      sceneId,
      level: 1,
      combat: {
        attack: { stab: 0, slash: 500, crush: 0, range: 0 },
        cooldowns: {},
      },
      skills: {
        attack: { level: 1, exp: 0 },
        defence: { level: 1, exp: 0 },
      },
      stats: {
        level: 1,
        attributes: { total: { strength: 500, dexterity: 10, intelligence: 10 } },
        resources: {
          health: { current: 100, max: 100 },
          mana: { current: 100, max: 100 },
        },
        lifecycle: { state: 'alive' },
      },
      recordSkillInput: vi.fn(() => true),
      refreshDerivedStats: vi.fn(),
    };
    const monster = makeMonster();
    monster.sceneId = sceneId;
    monster.spawn = { x: 11, y: 10, radius: 0 };
    monster.x = 11;
    monster.y = 10;

    const scene = world.ensureScene(sceneId, {
      type: 'test',
      map: { background: [], foreground: [] },
      monsters: [monster],
      metadata: { spawnPoints: [{ x: 10, y: 10 }] },
    });
    scene.players = [player];

    const first = Combat.tryUseSkill(player, { skillId: 'primary-attack', direction: 'right' });
    expect(first.hits).toHaveLength(1);
    expect(first.hits[0].died).toBe(true);
    expect(monster.isAlive).toBe(false);

    monster.respawnNow(Date.now() + 200);
    expect(monster.isAlive).toBe(true);
    expect(monster.x).toBe(11);
    expect(monster.y).toBe(10);

    const second = Combat.tryUseSkill(player, { skillId: 'primary-attack', direction: 'right' });
    expect(second.hits).toHaveLength(1);
    expect(second.hits[0].died).toBe(true);
    expect(monster.isAlive).toBe(false);
  });

  it('does not award defence experience when a monster hits the player', () => {
    const sceneId = 'test:monster-lifecycle-combat';
    const monster = makeMonster();
    monster.sceneId = sceneId;
    monster.x = 11;
    monster.y = 10;

    const player = {
      uuid: 'player-target',
      socket_id: 'socket-target',
      username: 'Target Tester',
      x: 10,
      y: 10,
      sceneId,
      skills: {
        attack: { level: 1, exp: 0 },
        defence: { level: 1, exp: 0 },
      },
      stats: {
        resources: {
          health: { current: 93, max: 100 },
          mana: { current: 50, max: 50 },
        },
        lifecycle: { state: 'alive' },
      },
      setAnimationState: vi.fn(),
      applyDamage: vi.fn(() => ({ type: 'damage', amount: 7 })),
    };

    const scene = world.ensureScene(sceneId, {
      type: 'test',
      map: { background: [], foreground: [] },
      monsters: [monster],
      metadata: { spawnPoints: [{ x: 10, y: 10 }] },
    });
    scene.players = [player];
    monster.state.pendingAttack = {
      targetId: player.uuid,
      resolveAt: 1_000,
      damage: 7,
    };

    const resolved = monster.resolvePendingAttack(1_000);

    expect(resolved).toBe(true);
    expect(player.skills.defence.exp).toBe(0);
    expect(Socket.emit).not.toHaveBeenCalledWith(
      'resource:skills:update',
      expect.anything(),
    );
  });

  it('reduces incoming monster damage while Stoneguard is active', () => {
    const sceneId = 'test:monster-stoneguard-mitigation';
    const monster = makeMonster();
    monster.sceneId = sceneId;
    monster.x = 11;
    monster.y = 10;

    const player = {
      uuid: 'player-stoneguard',
      socket_id: 'socket-stoneguard',
      username: 'Stoneguard Tester',
      x: 10,
      y: 10,
      sceneId,
      combat: {
        buffs: {
          'ability-3': {
            id: 'ability-3',
            armourBonus: 12,
            expiresAt: 2_000,
          },
        },
      },
      stats: {
        resources: {
          health: { current: 93, max: 100 },
          mana: { current: 50, max: 50 },
        },
        lifecycle: { state: 'alive' },
      },
      setAnimationState: vi.fn(),
      applyDamage: vi.fn(amount => ({ type: 'damage', amount })),
    };

    const scene = world.ensureScene(sceneId, {
      type: 'test',
      map: { background: [], foreground: [] },
      monsters: [monster],
      metadata: { spawnPoints: [{ x: 10, y: 10 }] },
    });
    scene.players = [player];
    monster.state.pendingAttack = {
      targetId: player.uuid,
      resolveAt: 1_000,
      damage: 15,
    };

    const resolved = monster.resolvePendingAttack(1_000);

    expect(resolved).toBe(true);
    expect(player.applyDamage).toHaveBeenCalledWith(3, expect.objectContaining({
      allowCheatDeath: true,
      now: 1_000,
    }));
    expect(Socket.broadcast).toHaveBeenCalledWith(
      'combat:hit',
      expect.objectContaining({ amount: 3, targetType: 'player' }),
      expect.anything(),
    );
  });

  it('keeps Frost Nova slowed monsters from stepping until the slowed interval elapses', () => {
    const sceneId = 'test:monster-frost-slow';
    const monster = makeMonster();
    monster.sceneId = sceneId;
    monster.x = 10;
    monster.y = 10;
    monster.spawn = { x: 10, y: 10, radius: 0 };
    monster.behaviour.stepIntervalMs = 1000;
    monster.state.lastStepAt = 0;
    monster.state.effects = {
      frostNova: {
        slowMultiplier: 0.5,
        expiresAt: 3_000,
      },
    };

    world.ensureScene(sceneId, {
      type: 'test',
      map: makeOpenMap(),
      monsters: [monster],
      metadata: { spawnPoints: [{ x: 10, y: 10 }] },
    });

    // Continuous movement: slows scale glide speed. stepIntervalMs 1000 at a
    // 0.5 slow = 0.5 tiles/sec, so one second of pursuit covers ~0.5 tiles
    // instead of the unslowed ~1.0.
    monster.pursue({ x: 12, y: 10 }, 1_200); // primes the glide clock
    expect(monster.x).toBe(10);

    expect(monster.pursue({ x: 12, y: 10 }, 2_200)).toBe(true);
    expect(monster.x).toBeGreaterThan(10.3);
    expect(monster.x).toBeLessThan(10.75); // unslowed pace would reach ~11
    expect(monster.movementStep.duration).toBeGreaterThan(150);
  });

  it('does not step onto living players while pursuing', () => {
    const sceneId = 'test:monster-player-collision';
    const monster = makeMonster();
    monster.sceneId = sceneId;
    monster.x = 10;
    monster.y = 10;
    monster.spawn = { x: 10, y: 10, radius: 0 };
    monster.behaviour.stepIntervalMs = 100;
    monster.state.lastStepAt = 0;

    const player = {
      uuid: 'player-blocker',
      x: 11,
      y: 10,
      sceneId,
      stats: {
        resources: {
          health: { current: 25, max: 25 },
        },
      },
    };

    const scene = world.ensureScene(sceneId, {
      type: 'test',
      map: makeOpenMap(),
      monsters: [monster],
      metadata: { spawnPoints: [{ x: 10, y: 10 }] },
    });
    scene.players = [player];

    // Continuous movement: the monster closes in but may never enter the
    // tile a living player is standing on.
    monster.pursue({ x: 12, y: 10 }, 1_000); // primes the glide clock
    for (let now = 1_200; now <= 3_000; now += 200) {
      monster.pursue({ x: 12, y: 10 }, now);
    }
    expect(Math.round(monster.x)).toBe(10);
    expect(Math.round(monster.y)).toBe(10);
    expect(monster.x).toBeLessThan(10.5);
  });

  it('does not step onto living monsters while pursuing', () => {
    const sceneId = 'test:monster-monster-collision';
    const monster = makeMonster();
    monster.sceneId = sceneId;
    monster.x = 10;
    monster.y = 10;
    monster.spawn = { x: 10, y: 10, radius: 0 };
    monster.behaviour.stepIntervalMs = 100;
    monster.state.lastStepAt = 0;

    const blocker = makeMonster();
    blocker.sceneId = sceneId;
    blocker.x = 11;
    blocker.y = 10;

    world.ensureScene(sceneId, {
      type: 'test',
      map: makeOpenMap(),
      monsters: [monster, blocker],
      metadata: { spawnPoints: [{ x: 10, y: 10 }] },
    });

    // Continuous movement: the blocker's tile stays exclusive.
    monster.pursue({ x: 12, y: 10 }, 1_000); // primes the glide clock
    for (let now = 1_200; now <= 3_000; now += 200) {
      monster.pursue({ x: 12, y: 10 }, now);
    }
    expect(Math.round(monster.x)).toBe(10);
    expect(Math.round(monster.y)).toBe(10);
    expect(monster.x).toBeLessThan(10.5);
  });
});
