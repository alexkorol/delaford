/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import GameMap from '#server/core/map.js';
import Monster from '#server/core/monster.js';
import { rollPlayerDamage } from '#server/core/combat/index.js';
import UI from '#shared/ui.js';
import { GLOBAL_COOLDOWN_MS } from '#shared/combat.js';
import { createCharacterState } from '#shared/stats/index.js';

// These assertions describe the *felt* fight and floor, measured through the
// real generation + combat code — not guessed per-monster thresholds. They
// were derived from a headless playtest sweep (see commit message): a level-1
// player must be able to mow through a dense pack while it focus-fires, and a
// floor must not be mostly empty corridor.

const PLAYER_ATTACK_INTERVAL = GLOBAL_COOLDOWN_MS / 1000; // seconds per hit

const makeLevelOnePlayer = (weaponPower = 0) => ({
  stats: createCharacterState({
    level: 1,
    attributes: { base: { strength: 10, dexterity: 10, intelligence: 10 } },
  }),
  combat: { attack: { stab: weaponPower, slash: 0, crush: 0, range: 0 } },
  uuid: 'balance-player',
  username: 'Tester',
});

const averagePlayerDamage = (player, samples = 4000) => {
  let total = 0;
  for (let i = 0; i < samples; i += 1) total += rollPlayerDamage(player, { id: 'primary-attack' });
  return total / samples;
};

const averageMonsterDamage = (monster, samples = 1500) => {
  let total = 0;
  for (let i = 0; i < samples; i += 1) total += monster.combatController.rollDamage();
  const value = total / samples;
  return Number.isFinite(value) ? value : 0;
};

const monsterInterval = (monster) => (
  ((monster.behaviour && monster.behaviour.attack && monster.behaviour.attack.intervalMs) || 1500) / 1000
);

// Player clears a pack lowest-HP-first while every living member focus-fires.
// Returns the HP fraction remaining, or -1 if the player dies mid-clear.
const simulatePackFocusFire = (pack, playerDps, playerHp) => {
  const alive = pack
    .map(monster => ({
      hp: monster.stats.resources.health.max,
      dps: averageMonsterDamage(monster) / monsterInterval(monster),
    }))
    .sort((a, b) => a.hp - b.hp);

  let taken = 0;
  for (let i = 0; i < alive.length; i += 1) {
    const killTime = alive[i].hp / playerDps;
    const incomingDps = alive.slice(i).reduce((sum, m) => sum + m.dps, 0);
    taken += incomingDps * killTime;
    if (taken >= playerHp) {
      return -1;
    }
  }
  return (playerHp - taken) / playerHp;
};

const measureFloor = (map, monsters, items) => {
  const width = Math.round(Math.sqrt(map.background.length));
  const idx = (x, y) => (y * width) + x;
  const walkTiles = [];
  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const bgOk = UI.tileWalkable(map.background[idx(x, y)] - 1);
      const fgGid = map.foreground[idx(x, y)];
      if (bgOk && (!fgGid || UI.tileWalkable(fgGid - 1, 'foreground'))) {
        walkTiles.push({ x, y });
      }
    }
  }
  const content = monsters.map(m => ({ x: m.spawn.x, y: m.spawn.y }))
    .concat((items || []).map(it => ({ x: it.x, y: it.y })));
  let dead = 0;
  walkTiles.forEach((tile) => {
    const near = content.some(c => Math.abs(tile.x - c.x) + Math.abs(tile.y - c.y) <= 4);
    if (!near) dead += 1;
  });
  return {
    walkable: walkTiles.length,
    deadFraction: dead / walkTiles.length,
    contentPer100: (content.length / walkTiles.length) * 100,
  };
};

const buildFloor = async (seed, layout = 'warren') => {
  const generation = await GameMap.generateInstance({ seed, template: 'dungeon', layout, depth: 1 });
  const monsters = generation.monsters.map(def => new Monster({ ...def, sceneId: 'balance-scene' }));
  return { generation, monsters };
};

describe('instance combat + floor balance (measured, ARPG feel)', () => {
  const seeds = [1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010];

  it('spawns dense floors of monsters', async () => {
    for (const seed of seeds) {
      const { monsters } = await buildFloor(seed);
      expect(monsters.length, `seed ${seed}`).toBeGreaterThanOrEqual(18);
    }
  });

  it('lets a level-1 player mow through a focus-firing pack in the vast majority of floors', async () => {
    let survived = 0;
    const remaining = [];
    for (const seed of seeds) {
      const { monsters } = await buildFloor(seed);
      const trash = monsters.filter(m => m.rarityId !== 'elite').slice(0, 5);
      const player = makeLevelOnePlayer(0); // unarmed = worst case
      const playerDps = averagePlayerDamage(player) / PLAYER_ATTACK_INTERVAL;
      const hp = player.stats.resources.health.max;
      const left = simulatePackFocusFire(trash, playerDps, hp);
      if (left >= 0) {
        survived += 1;
        remaining.push(left);
      }
    }
    // Winnable but dangerous: survives most floors, and when it does it costs
    // real HP (not a faceroll).
    expect(survived).toBeGreaterThanOrEqual(seeds.length - 2);
    const avgRemaining = remaining.reduce((s, v) => s + v, 0) / remaining.length;
    expect(avgRemaining).toBeLessThan(0.75); // loses meaningful HP
    expect(avgRemaining).toBeGreaterThan(0.15); // but usually survives with a buffer
  });

  it('used to be lethal: the pre-tune config would kill the player on the same packs', async () => {
    // Sanity anchor — with the old squishiness (much tankier/harder-hitting
    // trash) a level-1 player dies clearing a 5-pack. Confirms the regression
    // above is measuring the thing that was broken.
    const { monsters } = await buildFloor(seeds[0]);
    const trash = monsters.filter(m => m.rarityId !== 'elite').slice(0, 5);
    const player = makeLevelOnePlayer(0);
    const playerDps = averagePlayerDamage(player) / PLAYER_ATTACK_INTERVAL;
    const hp = player.stats.resources.health.max;
    // Emulate the old ~2.5x tankier / ~1.6x harder-hitting trash.
    const oldPack = trash.map(m => ({
      stats: { resources: { health: { max: m.stats.resources.health.max * 2.5 } } },
      behaviour: m.behaviour,
      combatController: { rollDamage: () => m.combatController.rollDamage() * 1.6 },
    }));
    expect(simulatePackFocusFire(oldPack, playerDps, hp)).toBe(-1);
  });

  it('guards the stairs with one tanky boss that is still not an endless slog', async () => {
    const { monsters } = await buildFloor(seeds[0]);
    const bosses = monsters.filter(m => m.rarityId === 'elite');
    expect(bosses).toHaveLength(1);
    const [boss] = bosses;
    const player = makeLevelOnePlayer(4); // player would have some gear by the boss
    const playerDps = averagePlayerDamage(player) / PLAYER_ATTACK_INTERVAL;
    const bossTtk = boss.stats.resources.health.max / playerDps;
    const trashPeak = Math.max(...monsters.filter(m => m.rarityId !== 'elite').map(m => m.stats.resources.health.max));
    expect(boss.stats.resources.health.max).toBeGreaterThan(trashPeak * 2); // real sponge
    expect(bossTtk).toBeLessThan(20); // but killable within a fight, not a 26s grind
  });

  it('keeps floors from being mostly empty corridor', async () => {
    const deadFractions = [];
    for (const seed of seeds) {
      const { generation, monsters } = await buildFloor(seed);
      const floor = measureFloor(generation.map, monsters, generation.items);
      deadFractions.push(floor.deadFraction);
      expect(floor.contentPer100, `seed ${seed} density`).toBeGreaterThan(1);
    }
    const avgDead = deadFractions.reduce((s, v) => s + v, 0) / deadFractions.length;
    // Was ~0.91 before the room/corridor rework; corridors still exist so this
    // is not zero, but the floor should read as populated.
    expect(avgDead).toBeLessThan(0.8);
  });

  it('keeps a full first-floor clear inside the early progression band', async () => {
    for (const layout of ['warren', 'gauntlet', 'clearings']) {
      for (const seed of seeds) {
        const { generation } = await buildFloor(seed, layout);
        const killExperience = generation.monsters
          .reduce((total, monster) => total + monster.rewards.experience, 0);
        const completionExperience = generation.metadata.rewards.experience.amount;
        const resultingLevel = UI.getLevel(killExperience + completionExperience);

        expect(resultingLevel, `${layout} seed ${seed}`).toBeGreaterThanOrEqual(6);
        expect(resultingLevel, `${layout} seed ${seed}`).toBeLessThanOrEqual(10);
      }
    }
  });

  it('forms an infinite ladder whose real combat pressure rises into a wall', async () => {
    const measurements = [];
    for (const depth of [1, 3, 6, 10]) {
      const generation = await GameMap.generateInstance({ seed: 20260710, template: 'dungeon', depth });
      const monsters = generation.monsters
        .map(definition => new Monster({ ...definition, sceneId: `depth-${depth}` }))
        .filter(monster => monster.rarityId !== 'elite')
        .slice(0, 5);
      measurements.push({
        averageHp: monsters.reduce((sum, monster) => sum + monster.stats.resources.health.max, 0) / monsters.length,
        averageDamage: monsters.reduce((sum, monster) => sum + averageMonsterDamage(monster), 0) / monsters.length,
        monsters,
      });
    }

    for (let index = 1; index < measurements.length; index += 1) {
      expect(measurements[index].averageHp).toBeGreaterThan(measurements[index - 1].averageHp);
      expect(measurements[index].averageDamage).toBeGreaterThan(measurements[index - 1].averageDamage);
    }

    const fresh = makeLevelOnePlayer(0);
    const freshDps = averagePlayerDamage(fresh) / PLAYER_ATTACK_INTERVAL;
    expect(simulatePackFocusFire(
      measurements[0].monsters,
      freshDps,
      fresh.stats.resources.health.max,
    )).toBeGreaterThan(0);
    expect(simulatePackFocusFire(
      measurements[2].monsters,
      freshDps,
      fresh.stats.resources.health.max,
    )).toBe(-1);
  });
});
