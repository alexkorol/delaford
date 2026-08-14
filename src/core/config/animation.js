import {
  DEFAULT_FACING_DIRECTION,
  DEFAULT_ANIMATION_DURATIONS,
  DEFAULT_ANIMATION_HOLDS,
} from '@shared/combat.js';

// human-v2.png is a 4x4 contact sheet. Rows are the four cardinal directions;
// columns are idle, two opposing stride poses, and a compact sword attack.
// Source frames are deliberately larger than their in-world footprint so the
// perspective renderer has enough detail for zoom and depth-of-field.
const baseRows = {
  down: 0,
  left: 1,
  right: 2,
  up: 3,
};

const idleFrames = [0];
const runFrames = [1, 2];
const attackFrames = [0, 3];

export const PLAYER_SPRITE_CONFIG = {
  tileSize: 64,
  renderSize: 32,
  perspectiveScale: 0.84,
  defaultState: 'idle',
  defaultDirection: DEFAULT_FACING_DIRECTION,
  states: {
    idle: {
      frames: idleFrames,
      frameDuration: 480,
      rows: baseRows,
      loop: true,
      holdState: null,
    },
    run: {
      frames: runFrames,
      frameDuration: 110,
      rows: baseRows,
      loop: true,
      holdState: null,
    },
    attack: {
      frames: attackFrames,
      frameDuration: 90,
      rows: baseRows,
      loop: false,
      holdState: DEFAULT_ANIMATION_HOLDS.attack,
      duration: DEFAULT_ANIMATION_DURATIONS.attack,
    },
    dash: {
      frames: runFrames,
      frameDuration: 70,
      rows: baseRows,
      loop: false,
      holdState: DEFAULT_ANIMATION_HOLDS.dash,
      duration: DEFAULT_ANIMATION_DURATIONS.dash,
    },
    hurt: {
      frames: idleFrames,
      frameDuration: 120,
      rows: baseRows,
      loop: false,
      holdState: DEFAULT_ANIMATION_HOLDS.hurt,
      duration: DEFAULT_ANIMATION_DURATIONS.hurt,
    },
  },
};

// Generated monsters and townsfolk are one 64px identity per column. They
// render into the same 32px world footprint as the player, retaining enough
// source detail for perspective zoom without pretending static identities are
// directional animation frames.
export const MONSTER_SPRITE_CONFIG = {
  tileSize: 64,
  renderSize: 32,
  perspectiveScale: 0.84,
};

export const NPC_SPRITE_CONFIG = {
  tileSize: 64,
  renderSize: 32,
  perspectiveScale: 0.84,
};

export const actorIdentityFrame = actor => ({
  column: Number.isFinite(actor && actor.column) ? actor.column : 0,
  row: 0,
});

export default PLAYER_SPRITE_CONFIG;
