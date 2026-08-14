/** @vitest-environment node */

import {
  describe, expect, it, vi,
} from 'vitest';

const scenePlayers = [];
const sceneMetadata = {};

vi.mock('#server/core/world.js', () => ({
  default: {
    getScenePlayers: () => scenePlayers,
    getScene: () => ({ id: 'scene-1', type: 'zone', metadata: sceneMetadata }),
  },
}));

vi.mock('#shared/ui.js', () => ({
  default: {
    // Deterministic: always roll the max so damage is predictable.
    getRandomInt: (min, max) => max,
  },
}));

const { rollPlayerDamage } = await import('#server/core/combat/index.js');
const { default: createMonsterCombatController } = await import('#server/core/entities/monster/combat-controller.js');
const { DEFAULT_SKILL_IDS } = await import('#shared/combat.js');

const makeNakedPlayer = (overrides = {}) => ({
  uuid: 'player-1',
  sceneId: 'scene-1',
  facing: 'left',
  // No wielded weapon: every attack rating is zero.
  combat: { attack: { stab: 0, slash: 0, crush: 0, range: 0 } },
  stats: {
    attributes: { total: { strength: 10, dexterity: 10, intelligence: 10 } },
    resources: { health: { current: 50, max: 50 } },
    lifecycle: { state: 'alive' },
  },
  setAnimationState: vi.fn(),
  applyDamage: vi.fn(function applyDamage(amount) {
    this.stats.resources.health.current = Math.max(0, this.stats.resources.health.current - amount);
    return { type: this.stats.resources.health.current <= 0 ? 'death' : 'damage', amount };
  }),
  ...overrides,
});

const makeMonster = (target, overrides = {}) => {
  const monster = {
    uuid: 'monster-1',
    name: 'Barrow Wolf',
    x: target.x ?? 10,
    y: target.y ?? 10,
    sceneId: 'scene-1',
    facing: 'right',
    isAlive: true,
    archetype: {},
    rarity: {},
    behaviour: { attack: { range: 1, windupMs: 0, damage: 6 } },
    state: {
      pendingAttack: {
        targetId: target.uuid,
        damage: 6,
        resolveAt: 0,
      },
    },
    setFacing: vi.fn(),
    setAnimationState: vi.fn(),
    ...overrides,
  };
  monster.combatController = createMonsterCombatController(monster);
  return monster;
};

describe('unarmed combat', () => {
  it('deals at least 1 damage with no weapon equipped', () => {
    const player = makeNakedPlayer();
    const damage = rollPlayerDamage(player, { id: 'melee:primary' });
    expect(damage).toBeGreaterThanOrEqual(1);
  });

  it('scales unarmed damage with strength', () => {
    const weak = rollPlayerDamage(makeNakedPlayer(), { id: 'melee:primary' });
    const strong = rollPlayerDamage(
      makeNakedPlayer({
        stats: {
          attributes: { total: { strength: 40, dexterity: 10, intelligence: 10 } },
          resources: { health: { current: 50, max: 50 } },
        },
      }),
      { id: 'melee:primary' },
    );
    expect(strong).toBeGreaterThan(weak);
  });
});

describe('auto-retaliation', () => {
  it('a struck, unengaged player fights back at their attacker', () => {
    const player = makeNakedPlayer({ x: 10, y: 10 });
    scenePlayers.length = 0;
    scenePlayers.push(player);

    const monster = makeMonster(player, { x: 10, y: 10 });
    const result = monster.combatController.resolvePendingAttack(1000);

    expect(result).toBeTruthy();
    expect(player.combat.autoAttack).toBeTruthy();
    expect(player.combat.autoAttack.targetId).toBe('monster-1');
    expect(player.combat.autoAttack.skillId).toBe(DEFAULT_SKILL_IDS.primary);
  });

  it('does not override an existing auto-attack target', () => {
    const player = makeNakedPlayer({ x: 10, y: 10 });
    player.combat.autoAttack = { targetId: 'other-monster', skillId: 'melee:primary' };
    scenePlayers.length = 0;
    scenePlayers.push(player);

    const monster = makeMonster(player, { x: 10, y: 10 });
    monster.combatController.resolvePendingAttack(1000);

    expect(player.combat.autoAttack.targetId).toBe('other-monster');
  });

  it('does not retaliate when the blow is fatal', () => {
    const player = makeNakedPlayer({ x: 10, y: 10 });
    player.stats.resources.health.current = 1;
    scenePlayers.length = 0;
    scenePlayers.push(player);

    const monster = makeMonster(player, { x: 10, y: 10 });
    monster.combatController.resolvePendingAttack(1000);

    expect(player.combat.autoAttack).toBeUndefined();
  });

  it('discards a pending monster hit while respawn protection is active', () => {
    const player = makeNakedPlayer({ x: 10, y: 10 });
    player.combat.respawnProtectionUntil = 2_000;
    scenePlayers.length = 0;
    scenePlayers.push(player);

    const monster = makeMonster(player, { x: 10, y: 10 });
    const result = monster.combatController.resolvePendingAttack(1_000);

    expect(result).toBe(false);
    expect(player.applyDamage).not.toHaveBeenCalled();
    expect(monster.state.pendingAttack).toBeNull();
  });

  it('deals no damage on sanctuary ground (the Crossroads truce)', () => {
    const player = makeNakedPlayer({ x: 10, y: 10 });
    scenePlayers.length = 0;
    scenePlayers.push(player);
    sceneMetadata.sanctuary = true;

    const monster = makeMonster(player, { x: 10, y: 10 });
    const result = monster.combatController.resolvePendingAttack(1000);
    delete sceneMetadata.sanctuary;

    expect(result).toBe(false);
    expect(player.applyDamage).not.toHaveBeenCalled();
    expect(player.stats.resources.health.current).toBe(50);
  });
});
