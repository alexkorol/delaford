/** @vitest-environment node */

import { beforeEach, describe, expect, it } from 'vitest';

import Monster from '#server/core/monster.js';
import world from '#server/core/world.js';

// Found in live play: support monsters healed a wounded ally EVERY AI tick
// (600ms) with no cooldown, for more than most trash mobs' entire health
// pool — the player watched their target's health climb while hitting it,
// and nothing near a healer could ever die. These tests drive the REAL
// Monster AI (monster.update) in a real world scene, not a mocked healer.

const SCENE_ID = 'support-heal-test';

const makeSupportDefinition = (overrides = {}) => ({
  id: 'test-healer',
  name: 'Test Chorister',
  level: 3,
  archetype: 'mystic',
  rarity: 'common',
  sceneId: SCENE_ID,
  spawn: { x: 10, y: 10, radius: 1 },
  behaviour: {
    type: 'support',
    aggressionRange: 6,
    support: { healAmount: 200, healRange: 6, healIntervalMs: 4000 },
    ...overrides.behaviour,
  },
  ...overrides,
});

const makeAllyDefinition = () => ({
  id: 'test-ally',
  name: 'Test Vanguard',
  level: 3,
  archetype: 'brute',
  rarity: 'common',
  sceneId: SCENE_ID,
  spawn: { x: 11, y: 10, radius: 1 },
  behaviour: { type: 'melee', aggressionRange: 6 },
});

describe('support monster healing pace (real AI)', () => {
  let healer;
  let ally;
  let scene;

  beforeEach(() => {
    scene = world.ensureScene(SCENE_ID, { type: 'instance', persistent: false });
    scene.players = [];
    healer = new Monster(makeSupportDefinition());
    ally = new Monster(makeAllyDefinition());
    healer.x = 10;
    healer.y = 10;
    ally.x = 11;
    ally.y = 10;
    scene.monsters = [healer, ally];
  });

  const woundAlly = () => {
    const health = ally.stats.resources.health;
    health.current = 1;
    return health;
  };

  it('caps a single heal at 30% of the ally maximum health', () => {
    const health = woundAlly();
    // Start well past the interval (in production `now` is Date.now(), so a
    // fresh healer's first heal is never gated).
    healer.update(100000);

    expect(health.current).toBeGreaterThan(1); // it did heal
    const healed = health.current - 1;
    expect(healed).toBeLessThanOrEqual(Math.round(health.max * 0.3));
  });

  it('respects the heal interval instead of healing every AI tick', () => {
    const health = woundAlly();
    let healEvents = 0;
    let previous = health.current;

    // Simulate 12 seconds of the real 600ms AI tick cadence.
    for (let now = 100000; now <= 112000; now += 600) {
      healer.update(now);
      if (health.current > previous) {
        healEvents += 1;
      }
      previous = health.current;
      // keep the ally wounded so the healer always has a valid target
      if (health.current > health.max - 5) {
        health.current = 1;
        previous = 1;
      }
    }

    // 12s at a 4s interval allows at most 4 heals (first is instant); the old
    // no-cooldown bug produced ~20.
    expect(healEvents).toBeGreaterThanOrEqual(2);
    expect(healEvents).toBeLessThanOrEqual(4);
  });

  it('keeps sustained healer throughput far below a level-1 player DPS', () => {
    // Use the real generation config (map.js: healAmount 8 + depth), not the
    // synthetic cap-probing value — this measures what players actually face.
    scene.monsters = [];
    healer = new Monster(makeSupportDefinition({
      behaviour: {
        type: 'support',
        aggressionRange: 6,
        support: { healAmount: 9, healRange: 6, healIntervalMs: 4000 },
      },
    }));
    healer.x = 10;
    healer.y = 10;
    ally = new Monster(makeAllyDefinition());
    ally.x = 11;
    ally.y = 10;
    scene.monsters = [healer, ally];

    const health = woundAlly();
    let totalHealed = 0;
    let previous = health.current;

    const seconds = 20;
    for (let now = 100000; now <= 100000 + (seconds * 1000); now += 600) {
      healer.update(now);
      if (health.current > previous) {
        totalHealed += health.current - previous;
      }
      previous = health.current;
      if (health.current > health.max - 5) {
        health.current = 1;
        previous = 1;
      }
    }

    const healerHps = totalHealed / seconds;
    // Level-1 unarmed player ≈ 18.5 DPS; the healer must lose that race by a
    // wide margin or packs become unkillable again.
    expect(healerHps).toBeLessThan(6);
  });
});
