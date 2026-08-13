import { surfaceMonsterGraphic } from '#shared/actor-graphics.js';

export default [
  {
    id: 'ashen-wolf',
    name: 'Ashen Wolf',
    tags: ['beast'],
    level: 4,
    archetype: 'skirmisher',
    rarity: 'common',
    sceneId: null,
    graphic: surfaceMonsterGraphic('ashen-wolf'),
    spawn: {
      x: 42,
      y: 118,
      radius: 4,
    },
    behaviour: {
      patrolRadius: 5,
      aggressionRange: 7,
    },
    rewards: {
      experience: 24,
    },
    respawn: {
      delayMs: 12000,
    },
  },
  {
    id: 'hollow-guard',
    name: 'Hollow Guard',
    level: 6,
    archetype: 'brute',
    rarity: 'uncommon',
    sceneId: null,
    graphic: surfaceMonsterGraphic('hollow-guard'),
    spawn: {
      x: 55,
      y: 112,
      radius: 3,
    },
    behaviour: {
      aggressionRange: 6,
      patrolRadius: 3,
    },
    rewards: {
      experience: 48,
    },
    respawn: {
      delayMs: 18000,
    },
  },
  {
    id: 'ember-seer',
    name: 'Ember Seer',
    level: 8,
    archetype: 'mystic',
    rarity: 'rare',
    sceneId: null,
    graphic: surfaceMonsterGraphic('ember-seer'),
    spawn: {
      x: 61,
      y: 125,
      radius: 5,
    },
    behaviour: {
      aggressionRange: 8,
      pursuitRange: 12,
    },
    rewards: {
      experience: 120,
    },
    respawn: {
      delayMs: 26000,
    },
  },
];
