import {
  DEFAULT_FACING_DIRECTION,
  DEFAULT_ANIMATION_DURATIONS,
  DEFAULT_ANIMATION_HOLDS,
} from '@shared/combat.js';

// The current human sprite sheet (human.png) is a single 32x32 frame: one
// column, one row. Every state must therefore point at column 0 and row 0 —
// referencing columns 1/2 (as the old run/attack/dash/hurt frames did) samples
// outside the image and draws nothing, which made the character flicker and
// vanish while acting. States keep their durations/holds so the combat state
// machine still works; only the (nonexistent) frame motion is removed. When a
// multi-frame sprite lands, restore per-state frame arrays and rows here.
const baseRows = {
  down: 0,
  left: 0,
  right: 0,
  up: 0,
};

const singleFrame = [0];

export const PLAYER_SPRITE_CONFIG = {
  tileSize: 32,
  defaultState: 'idle',
  defaultDirection: DEFAULT_FACING_DIRECTION,
  states: {
    idle: {
      frames: singleFrame,
      frameDuration: 480,
      rows: baseRows,
      loop: true,
      holdState: null,
    },
    run: {
      frames: singleFrame,
      frameDuration: 110,
      rows: baseRows,
      loop: true,
      holdState: null,
    },
    attack: {
      frames: singleFrame,
      frameDuration: 90,
      rows: baseRows,
      loop: false,
      holdState: DEFAULT_ANIMATION_HOLDS.attack,
      duration: DEFAULT_ANIMATION_DURATIONS.attack,
    },
    dash: {
      frames: singleFrame,
      frameDuration: 70,
      rows: baseRows,
      loop: false,
      holdState: DEFAULT_ANIMATION_HOLDS.dash,
      duration: DEFAULT_ANIMATION_DURATIONS.dash,
    },
    hurt: {
      frames: singleFrame,
      frameDuration: 120,
      rows: baseRows,
      loop: false,
      holdState: DEFAULT_ANIMATION_HOLDS.hurt,
      duration: DEFAULT_ANIMATION_DURATIONS.hurt,
    },
  },
};

export default PLAYER_SPRITE_CONFIG;
