/** @vitest-environment node */

import { describe, expect, it, beforeEach, vi } from 'vitest';

const scenes = new Map();

vi.mock('#server/core/world.js', () => ({
  default: {
    players: [],
    defaultTownId: 'town-1',
    getScene: (id) => scenes.get(id) || null,
    getSceneForPlayer: (player) => scenes.get(player.sceneId) || null,
    getScenePlayers: (id) => {
      const scene = scenes.get(id);
      return scene && Array.isArray(scene.players) ? scene.players : [];
    },
    getDefaultTown: () => scenes.get('town-1'),
    map: { background: [], foreground: [] },
  },
}));

vi.mock('#server/socket.js', () => ({
  default: {
    emit: vi.fn(),
    broadcast: vi.fn(),
    sendMessageToPlayer: vi.fn(),
  },
}));

vi.mock('#server/core/monster.js', () => ({
  default: { broadcast: vi.fn() },
}));

vi.mock('#server/core/player.js', () => ({
  default: {
    broadcastMovement: vi.fn(),
    broadcastAnimation: vi.fn(),
    broadcastStats: vi.fn(),
  },
}));

vi.mock('#server/core/entities/player/stats-manager.js', () => ({
  broadcastStats: vi.fn(),
  default: vi.fn(),
}));

const { default: Combat } = await import('#server/core/combat/index.js');
const { default: Socket } = await import('#server/socket.js');
const { default: Player } = await import('#server/core/player.js');
const { default: world } = await import('#server/core/world.js');
const { default: UI } = await import('#shared/ui.js');
const { broadcastStats } = await import('#server/core/entities/player/stats-manager.js');

const makeMonster = (overrides = {}) => {
  const monster = {
    uuid: `monster-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Fiend',
    x: 11,
    y: 10,
    level: 3,
    sceneId: 'scene-1',
    rewards: { experience: 50 },
    stats: { resources: { health: { current: 30, max: 30 } } },
    ...overrides,
  };

  monster.isAlive = true;
  monster.takeDamage = vi.fn((amount) => {
    const health = monster.stats.resources.health;
    health.current = Math.max(0, health.current - amount);
    if (health.current <= 0) {
      monster.isAlive = false;
      return { type: 'death', timestamp: Date.now() };
    }
    return { type: 'damage', amount, timestamp: Date.now() };
  });

  return monster;
};

const makePlayer = (overrides = {}) => {
  const player = {
    uuid: 'player-1',
    socket_id: 'socket-1',
    username: 'Hero',
    x: 10,
    y: 10,
    level: 1,
    facing: 'right',
    sceneId: 'scene-1',
    combat: {
      attack: { stab: 0, slash: 0, crush: 0, range: 0 },
      globalCooldown: 0,
      sequence: 0,
    },
    skills: {
      attack: { level: 1, exp: 0 },
      defence: { level: 1, exp: 0 },
    },
    stats: {
      level: 1,
      attributes: { total: { strength: 10, dexterity: 10, intelligence: 10 } },
      resources: {
        health: { current: 50, max: 50 },
        mana: { current: 40, max: 40 },
      },
      lifecycle: { state: 'alive' },
    },
    recordSkillInput: vi.fn(() => true),
    refreshDerivedStats: vi.fn(),
    tryRespawn: vi.fn(),
    cancelPathfinding: vi.fn(),
    setFacing: vi.fn((direction) => {
      player.facing = direction;
      return direction;
    }),
    registerMovementStep: vi.fn((step) => {
      player.movementStep = step;
      return step;
    }),
    applyHealing: vi.fn((amount) => {
      const health = player.stats.resources.health;
      const before = health.current;
      health.current = Math.min(health.max, health.current + Math.max(0, Math.floor(amount)));
      return {
        type: 'heal',
        amount: health.current - before,
        health: { ...health },
      };
    }),
    ...overrides,
  };

  return player;
};

describe('combat hit detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scenes.clear();
    world.players.length = 0;
  });

  it('melee arc covers the front tile and both flanks', () => {
    const player = { x: 10, y: 10 };

    const up = Combat.getMeleeArcTiles(player, 'up');
    expect(up).toContainEqual({ x: 10, y: 9 });
    expect(up).toContainEqual({ x: 9, y: 9 });
    expect(up).toContainEqual({ x: 11, y: 9 });

    const diagonal = Combat.getMeleeArcTiles(player, 'down-right');
    expect(diagonal).toContainEqual({ x: 11, y: 11 });
    expect(diagonal).toContainEqual({ x: 11, y: 10 });
    expect(diagonal).toContainEqual({ x: 10, y: 11 });
  });

  it('finds melee targets only inside the arc', () => {
    const player = makePlayer({ facing: 'right' });
    const inFront = makeMonster({ x: 11, y: 10 });
    const flank = makeMonster({ x: 11, y: 9 });
    const behind = makeMonster({ x: 9, y: 10 });
    const far = makeMonster({ x: 14, y: 10 });

    scenes.set('scene-1', {
      id: 'scene-1',
      players: [player],
      monsters: [inFront, flank, behind, far],
      map: { background: [], foreground: [] },
    });

    const targets = Combat.findMeleeTargets(player, 'right');
    const ids = targets.map((monster) => monster.uuid);
    expect(ids).toContain(inFront.uuid);
    expect(ids).toContain(flank.uuid);
    expect(ids).not.toContain(behind.uuid);
    expect(ids).not.toContain(far.uuid);
  });

  it('projectiles hit the first monster in line within range', () => {
    const player = makePlayer({ facing: 'right' });
    const near = makeMonster({ x: 13, y: 10 });
    const farther = makeMonster({ x: 14, y: 10 });

    scenes.set('scene-1', {
      id: 'scene-1',
      players: [player],
      monsters: [farther, near],
      map: null,
    });

    const target = Combat.findProjectileTarget(player, 'right', 5);
    expect(target).toBe(near);

    const outOfRange = Combat.findProjectileTarget(player, 'right', 2);
    expect(outOfRange).toBeNull();
  });
});

describe('player damage rolls', () => {
  it('scales melee damage with strength and weapon power', () => {
    const weak = makePlayer();
    const strong = makePlayer({
      stats: {
        ...makePlayer().stats,
        attributes: { total: { strength: 50, dexterity: 10, intelligence: 10 } },
      },
      combat: { attack: { stab: 0, slash: 20, crush: 0, range: 0 } },
    });

    for (let i = 0; i < 25; i += 1) {
      const weakRoll = Combat.rollPlayerDamage(weak, {});
      const strongRoll = Combat.rollPlayerDamage(strong, {});
      expect(weakRoll).toBeGreaterThanOrEqual(1);
      // strong minimum (0.75 * base) always beats the weak maximum
      expect(strongRoll).toBeGreaterThan(9);
    }
  });

  it('uses intelligence for mana-costed skills', () => {
    const caster = makePlayer({
      stats: {
        ...makePlayer().stats,
        attributes: { total: { strength: 1, dexterity: 1, intelligence: 60 } },
      },
    });

    const roll = Combat.rollPlayerDamage(caster, { resourceCost: { mana: 12 } });
    expect(roll).toBeGreaterThanOrEqual(Math.floor((4 + 30) * 0.75));
  });
});

describe('tryUseSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scenes.clear();
  });

  const setupScene = (player, monsters) => {
    scenes.set('scene-1', {
      id: 'scene-1',
      type: 'instance',
      players: [player],
      monsters,
      map: { background: [], foreground: [] },
    });
  };

  it('damages an adjacent monster with the primary attack', () => {
    const player = makePlayer({ facing: 'right' });
    const monster = makeMonster({ x: 11, y: 10 });
    setupScene(player, [monster]);

    const outcome = Combat.tryUseSkill(player, { skillId: 'primary-attack', direction: 'right' });

    expect(outcome.triggered).toBe(true);
    expect(outcome.hits).toHaveLength(1);
    expect(player.combat.autoAttack).toEqual(expect.objectContaining({
      targetId: monster.uuid,
      skillId: 'primary-attack',
    }));
    expect(monster.takeDamage).toHaveBeenCalled();
    expect(Socket.broadcast).toHaveBeenCalledWith(
      'combat:hit',
      expect.objectContaining({
        targetId: monster.uuid,
        targetType: 'monster',
        attackStyle: 'slash',
      }),
      expect.anything(),
    );
  });

  it('awards attack experience when the monster dies', () => {
    const player = makePlayer({ facing: 'right' });
    const monster = makeMonster({
      x: 11,
      y: 10,
      stats: { resources: { health: { current: 1, max: 30 } } },
      rewards: { experience: 80 },
    });
    setupScene(player, [monster]);

    const outcome = Combat.tryUseSkill(player, { skillId: 'primary-attack', direction: 'right' });

    expect(outcome.hits[0].died).toBe(true);
    expect(outcome.hits[0]).toEqual(expect.objectContaining({
      targetName: 'Test Fiend',
      skillName: 'Blade Sweep',
      experience: expect.objectContaining({
        skillId: 'attack',
        amount: 80,
      }),
    }));
    expect(player.skills.attack.exp).toBe(80);
    expect(Socket.emit).toHaveBeenCalledWith(
      'resource:skills:update',
      expect.objectContaining({ data: player.skills }),
    );
  });

  it('clears auto attack immediately when the primary hit kills its target', () => {
    const player = makePlayer({ facing: 'right' });
    const monster = makeMonster({
      x: 11,
      y: 10,
      stats: { resources: { health: { current: 1, max: 30 } } },
    });
    player.combat.autoAttack = {
      targetId: monster.uuid,
      targetName: monster.name,
      sceneId: 'scene-1',
      skillId: 'primary-attack',
      startedAt: 1_000,
      lastTriggeredAt: 1_000,
    };
    setupScene(player, [monster]);

    const outcome = Combat.tryUseSkill(player, { skillId: 'primary-attack', direction: 'right' });

    expect(outcome.hits[0].died).toBe(true);
    expect(player.combat.autoAttack).toBeNull();
    expect(player.combat.autoAttackStoppedReason).toBe('target-dead');
  });

  it('raises the character level once combat experience crosses the curve', () => {
    const player = makePlayer({ facing: 'right' });
    const bigReward = UI.getExperience(3) + 10;
    const monster = makeMonster({
      x: 11,
      y: 10,
      stats: { resources: { health: { current: 1, max: 30 } } },
      rewards: { experience: bigReward },
    });
    setupScene(player, [monster]);

    Combat.tryUseSkill(player, { skillId: 'primary-attack', direction: 'right' });

    expect(player.level).toBe(3);
    expect(player.refreshDerivedStats).toHaveBeenCalled();
  });

  it('rejects skills while dead, on cooldown, or without mana', () => {
    const dead = makePlayer();
    dead.stats.resources.health.current = 0;
    setupScene(dead, []);
    expect(Combat.tryUseSkill(dead, { skillId: 'primary-attack' })).toBeNull();

    const broke = makePlayer();
    broke.stats.resources.mana.current = 0;
    setupScene(broke, []);
    expect(Combat.tryUseSkill(broke, { skillId: 'ability-1' })).toBeNull();

    const cooling = makePlayer();
    cooling.combat.cooldowns = { 'ability-1': Date.now() + 60000 };
    setupScene(cooling, []);
    expect(Combat.tryUseSkill(cooling, { skillId: 'ability-1' })).toBeNull();
  });

  it('deducts mana for costed abilities', () => {
    const player = makePlayer({ facing: 'right' });
    setupScene(player, []);

    const outcome = Combat.tryUseSkill(player, { skillId: 'ability-1', direction: 'right' });
    expect(outcome.triggered).toBe(true);
    expect(player.stats.resources.mana.current).toBe(40 - 12);
    expect(player.combat.cooldowns['ability-1']).toBeGreaterThan(Date.now());
  });

  it('moves dash skills across open tiles and stops before blocked collision', () => {
    const player = makePlayer({
      facing: 'right',
      canMoveTo: vi.fn((x) => x <= 12),
    });
    setupScene(player, []);

    const outcome = Combat.tryUseSkill(player, { skillId: 'dash', direction: 'right' });

    expect(outcome.triggered).toBe(true);
    expect(outcome.movement).toEqual(expect.objectContaining({
      moved: true,
      steps: 2,
      blocked: true,
      direction: 'right',
    }));
    expect(player.x).toBe(12);
    expect(player.registerMovementStep).toHaveBeenCalledWith(expect.objectContaining({
      direction: 'right',
      blocked: true,
      steps: 2,
    }));
    expect(Player.broadcastMovement).toHaveBeenCalledWith(player);
  });

  it('damages and slows only monsters inside Frost Nova radius', () => {
    const player = makePlayer({ facing: 'right' });
    const near = makeMonster({ x: 11, y: 10, state: {} });
    const diagonal = makeMonster({ x: 12, y: 12, state: {} });
    const far = makeMonster({ x: 14, y: 10, state: {} });
    setupScene(player, [near, diagonal, far]);

    const outcome = Combat.tryUseSkill(player, { skillId: 'ability-2', direction: 'right' });

    expect(outcome.triggered).toBe(true);
    expect(outcome.hits.map(hit => hit.targetId)).toEqual(expect.arrayContaining([
      near.uuid,
      diagonal.uuid,
    ]));
    expect(outcome.hits.map(hit => hit.targetId)).not.toContain(far.uuid);
    expect(near.state.effects.frostNova).toEqual(expect.objectContaining({
      sourceId: player.uuid,
      slowMultiplier: 0.6,
    }));
    expect(diagonal.state.effects.frostNova).toEqual(expect.objectContaining({
      sourceId: player.uuid,
      slowMultiplier: 0.6,
    }));
    expect(far.takeDamage).not.toHaveBeenCalled();
  });

  it('stores Stoneguard as a timed defensive buff', () => {
    const player = makePlayer();
    setupScene(player, []);

    const outcome = Combat.tryUseSkill(player, { skillId: 'ability-3', direction: 'right' });

    expect(outcome.triggered).toBe(true);
    expect(outcome.buff).toEqual(expect.objectContaining({
      id: 'ability-3',
      armourBonus: 12,
    }));
    expect(player.combat.buffs['ability-3']).toBe(outcome.buff);
    expect(player.stats.resources.mana.current).toBe(30);
  });

  it('heals the player with Celestial Mend and broadcasts stat changes', () => {
    const player = makePlayer({
      stats: {
        ...makePlayer().stats,
        resources: {
          health: { current: 20, max: 50 },
          mana: { current: 40, max: 40 },
        },
      },
    });
    setupScene(player, []);

    const outcome = Combat.tryUseSkill(player, { skillId: 'ability-4', direction: 'right' });

    expect(outcome.triggered).toBe(true);
    expect(outcome.healing).toEqual(expect.objectContaining({
      targetId: player.uuid,
      amount: 21,
    }));
    expect(player.stats.resources.health.current).toBe(41);
    expect(player.stats.resources.mana.current).toBe(18);
    expect(broadcastStats).toHaveBeenCalledWith(player);
  });

  it('initialises missing combat state before using a skill', () => {
    const player = makePlayer({ facing: 'right' });
    delete player.combat;
    setupScene(player, []);

    const outcome = Combat.tryUseSkill(player, { skillId: 'primary-attack', direction: 'right' });

    expect(outcome.triggered).toBe(true);
    expect(player.combat).toEqual(expect.objectContaining({
      cooldowns: expect.any(Object),
    }));
  });

  it('does not hit monsters in other scenes', () => {
    const player = makePlayer({ facing: 'right' });
    const monster = makeMonster({ x: 11, y: 10, sceneId: 'scene-2' });
    setupScene(player, []);
    scenes.set('scene-2', {
      id: 'scene-2',
      players: [],
      monsters: [monster],
      map: { background: [], foreground: [] },
    });

    const outcome = Combat.tryUseSkill(player, { skillId: 'primary-attack', direction: 'right' });
    expect(outcome.hits).toHaveLength(0);
    expect(monster.takeDamage).not.toHaveBeenCalled();
  });

  it('turns a movement step into a primary attack when a monster occupies the target tile', () => {
    const player = makePlayer({ facing: 'down' });
    const monster = makeMonster({ x: 11, y: 10 });
    setupScene(player, [monster]);

    const target = Combat.findStepTarget(player, 'right');
    const outcome = Combat.tryPrimaryAttackIntoStep(player, 'right');

    expect(target).toBe(monster);
    expect(outcome.triggered).toBe(true);
    expect(outcome.hits).toHaveLength(1);
    expect(monster.takeDamage).toHaveBeenCalled();
  });

  it('continues primary attacks against the engaged adjacent target', () => {
    const player = makePlayer({ facing: 'right' });
    const monster = makeMonster({ x: 11, y: 10 });
    player.combat.autoAttack = {
      targetId: monster.uuid,
      targetName: monster.name,
      sceneId: 'scene-1',
      skillId: 'primary-attack',
      startedAt: 1_000,
      lastTriggeredAt: 1_000,
    };
    setupScene(player, [monster]);
    world.players.splice(0, world.players.length, player);

    const summary = Combat.processAutoAttacks(1_500);

    expect(summary).toEqual(expect.objectContaining({ processed: 1, triggered: 1, cleared: 0 }));
    expect(monster.takeDamage).toHaveBeenCalled();
    expect(player.recordSkillInput).toHaveBeenCalledWith('primary-attack', expect.objectContaining({
      now: 1_500,
      direction: 'right',
      modifiers: { auto: true },
    }));
    expect(Socket.broadcast).toHaveBeenCalledWith(
      'player:combat:update',
      expect.objectContaining({ playerId: player.uuid, combat: player.combat }),
      expect.anything(),
    );
  });

  it('clears auto attack when the target leaves melee range', () => {
    const player = makePlayer({ facing: 'right' });
    const monster = makeMonster({ x: 14, y: 10 });
    player.combat.autoAttack = {
      targetId: monster.uuid,
      targetName: monster.name,
      sceneId: 'scene-1',
      skillId: 'primary-attack',
      startedAt: 1_000,
      lastTriggeredAt: 1_000,
    };
    setupScene(player, [monster]);
    world.players.splice(0, world.players.length, player);

    const summary = Combat.processAutoAttacks(1_500);

    expect(summary).toEqual(expect.objectContaining({ processed: 1, triggered: 0, cleared: 1 }));
    expect(player.combat.autoAttack).toBeNull();
    expect(player.combat.autoAttackStoppedReason).toBe('target-out-of-range');
    expect(monster.takeDamage).not.toHaveBeenCalled();
  });

  it('counts auto attack cleanup immediately when the auto swing kills its target', () => {
    const player = makePlayer({ facing: 'right' });
    const monster = makeMonster({
      x: 11,
      y: 10,
      stats: { resources: { health: { current: 1, max: 30 } } },
    });
    player.combat.autoAttack = {
      targetId: monster.uuid,
      targetName: monster.name,
      sceneId: 'scene-1',
      skillId: 'primary-attack',
      startedAt: 1_000,
      lastTriggeredAt: 1_000,
    };
    setupScene(player, [monster]);
    world.players.splice(0, world.players.length, player);

    const summary = Combat.processAutoAttacks(2_000);

    expect(summary).toEqual(expect.objectContaining({ processed: 1, triggered: 1, cleared: 1 }));
    expect(player.recordSkillInput).toHaveBeenCalledWith('primary-attack', expect.objectContaining({
      now: 2_000,
      direction: 'right',
      modifiers: { auto: true },
    }));
    expect(player.combat.autoAttack).toBeNull();
    expect(player.combat.autoAttackStoppedReason).toBe('target-dead');
  });
});

describe('player respawns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scenes.clear();
    world.players.length = 0;
  });

  it('respawns players at the instance entry once the timer elapses', () => {
    const player = makePlayer();
    player.stats.resources.health.current = 0;
    player.stats.lifecycle = {
      state: 'awaiting-respawn',
      respawn: { pending: true, at: Date.now() - 1000 },
    };
    player.tryRespawn = vi.fn(() => {
      player.stats.resources.health.current = 25;
      player.stats.lifecycle.state = 'alive';
      player.stats.lifecycle.respawn.pending = false;
      return { success: true };
    });
    player.path = { grid: {} };

    scenes.set('scene-1', {
      id: 'scene-1',
      type: 'instance',
      players: [player],
      monsters: [],
      metadata: { spawnPoints: [{ x: 3, y: 4 }] },
    });
    world.players.push(player);

    Combat.processPlayerRespawns(Date.now());

    expect(player.tryRespawn).toHaveBeenCalled();
    expect(player.x).toBe(3);
    expect(player.y).toBe(4);
    expect(player.path.grid).toBeNull();
  });

  it('leaves players alone before their respawn timer', () => {
    const player = makePlayer();
    player.stats.lifecycle = {
      state: 'awaiting-respawn',
      respawn: { pending: true, at: Date.now() + 60000 },
    };
    world.players.push(player);

    Combat.processPlayerRespawns(Date.now());
    expect(player.tryRespawn).not.toHaveBeenCalled();
  });
});
