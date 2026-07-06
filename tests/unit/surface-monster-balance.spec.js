/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import createWorldLayout from '#server/core/world-layout.js';
import GameMap from '#server/core/map.js';
import Monster from '#server/core/monster.js';
import { createCharacterState } from '#shared/stats/index.js';

// Found by playing: surface monsters were never given the measured tuning the
// instances got — Reed Witch hit for 41 (3 hits to kill) in the zone right
// outside town, Bone Oracle for 60, Ash Seer for 70 (2 hits). These specs
// measure the REAL world-layout definitions through the REAL Monster damage
// pipeline against an at-level player: no overworld monster may delete a
// player of its own level in a couple of swings.

const averageDamage = (monster, samples = 1500) => {
  let total = 0;
  for (let i = 0; i < samples; i += 1) total += monster.combatController.rollDamage();
  return total / samples;
};

const atLevelPlayerHealth = (level) => createCharacterState({
  level,
  attributes: { base: { strength: 10, dexterity: 10, intelligence: 10 } },
}).resources.health.max;

describe('surface monster balance (measured, at-level)', () => {
  const scenes = createWorldLayout();
  const sceneList = Array.isArray(scenes) ? scenes : (scenes.scenes || []);
  const withMonsters = sceneList.filter(scene => Array.isArray(scene.metadata.monsterDefinitions)
    && scene.metadata.monsterDefinitions.length);

  it('covers the overworld zones', () => {
    expect(withMonsters.length).toBeGreaterThanOrEqual(4);
  });

  withMonsters.forEach((scene) => {
    it(`${scene.name}: no monster kills an at-level player in under 6 hits`, () => {
      scene.metadata.monsterDefinitions.forEach((definition) => {
        const monster = new Monster({ ...definition, sceneId: scene.id });
        const damage = averageDamage(monster);
        const playerHealth = atLevelPlayerHealth(definition.level);
        const hitsToDie = playerHealth / damage;
        expect(hitsToDie, `${definition.name} (${damage.toFixed(1)}/hit vs ${playerHealth} HP)`)
          .toBeGreaterThanOrEqual(6);
      });
    });
  });

  it('overworld monsters die in ARPG time, not sponge time', () => {
    // Playtest feedback: "the first monster out of town is a Tank". Player
    // unarmed DPS is level-independent (~18.6); measure kill time per mob.
    const TTK_LIMITS = { common: 7, uncommon: 9, rare: 13 };
    withMonsters.forEach((scene) => {
      scene.metadata.monsterDefinitions.forEach((definition) => {
        const monster = new Monster({ ...definition, sceneId: scene.id });
        const hp = monster.stats.resources.health.max;
        const ttk = hp / 18.6;
        const limit = TTK_LIMITS[definition.rarity] || TTK_LIMITS.uncommon;
        expect(ttk, `${definition.name} (${hp} HP = ${ttk.toFixed(1)}s)`)
          .toBeLessThanOrEqual(limit);
      });
    });

    // The very first monster a new player meets must feel mowable.
    const oldWood = withMonsters.find(scene => scene.id === 'zone:old-wood');
    const wolf = oldWood.metadata.monsterDefinitions.find(def => def.id === 'oldwood-wolf');
    const wolfMonster = new Monster({ ...wolf, sceneId: oldWood.id });
    expect(wolfMonster.stats.resources.health.max / 18.6).toBeLessThanOrEqual(3.5);
  });

  it('instance boss needs at least 3 swings to drop a fresh level-1 player', async () => {
    const generation = await GameMap.generateInstance({ seed: 77, template: 'dungeon', depth: 1 });
    const bossDef = generation.monsters.find(def => def.rarity === 'elite');
    expect(bossDef).toBeTruthy();
    const boss = new Monster({ ...bossDef, sceneId: 'balance-check' });
    const damage = averageDamage(boss);
    const levelOneHealth = atLevelPlayerHealth(1);
    expect(levelOneHealth / damage, `boss hits ${damage.toFixed(1)} vs ${levelOneHealth} HP`)
      .toBeGreaterThanOrEqual(3);
  });
});
