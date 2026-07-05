/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import GameMap from '#server/core/map.js';
import Monster from '#server/core/monster.js';

// ARPG feel: dense packs of squishy trash you can mow through, guarded by a
// tanky boss — not a handful of damage sponges.

const buildFloor = async (depth = 1, seed = 4242) => {
  const generation = await GameMap.generateInstance({ seed, template: 'dungeon', depth });
  return generation.monsters.map(def => new Monster({ ...def, sceneId: 'balance-scene' }));
};

const maxHealth = monster => monster.stats.resources.health.max;

describe('instance combat balance', () => {
  it('spawns a dense floor of monsters', async () => {
    const monsters = await buildFloor(1);
    expect(monsters.length).toBeGreaterThanOrEqual(12);
  });

  it('keeps floor-1 common trash squishy and low level', async () => {
    const monsters = await buildFloor(1);
    const commonTrash = monsters.filter(m => m.rarityId === 'common');
    expect(commonTrash.length).toBeGreaterThan(0);

    commonTrash.forEach((monster) => {
      expect(monster.level).toBeLessThanOrEqual(4);
      // A ~110 HP / ~10 damage starter should kill common trash in a handful
      // of hits, not dozens.
      expect(maxHealth(monster)).toBeLessThanOrEqual(90);
    });

    const median = [...commonTrash.map(maxHealth)].sort((a, b) => a - b)[Math.floor(commonTrash.length / 2)];
    expect(median).toBeLessThanOrEqual(60);
  });

  it('trash hits softer than the shared base thanks to the damage scale', async () => {
    const monsters = await buildFloor(1);
    const trash = monsters.filter(m => m.rarityId !== 'elite');
    trash.forEach((monster) => {
      expect(monster.damageMultiplier).toBeLessThan(1);
      // Even the hardest trash swing leaves a starter alive for several hits.
      expect(monster.combatController.rollDamage()).toBeLessThanOrEqual(40);
    });
  });

  it('guards the stairs with a single tanky boss', async () => {
    const monsters = await buildFloor(1);
    const bosses = monsters.filter(m => m.rarityId === 'elite');
    expect(bosses).toHaveLength(1);

    const [boss] = bosses;
    expect(boss.healthMultiplier).toBe(1);
    // The boss is a genuine damage sponge next to the trash around it.
    const trashPeak = Math.max(...monsters.filter(m => m.rarityId !== 'elite').map(maxHealth));
    expect(maxHealth(boss)).toBeGreaterThan(trashPeak * 2);
  });
});
