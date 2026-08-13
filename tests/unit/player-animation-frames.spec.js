/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

import { PLAYER_SPRITE_CONFIG } from '@/core/config/animation.js';

// Regression: animation states that referenced frames outside an older sheet
// sampled empty pixels and made the character flicker and vanish while acting.
// Every v2 pose must remain inside the 4x4 sheet contract.

const pngDimensions = (path) => {
  const buffer = readFileSync(path);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
};

describe('player animation frames stay within the sprite sheet', () => {
  const spritePath = fileURLToPath(
    new URL('../../src/assets/graphics/actors/players/human-v2.png', import.meta.url),
  );
  const { width, height } = pngDimensions(spritePath);
  const tile = PLAYER_SPRITE_CONFIG.tileSize;
  const maxColumn = Math.floor(width / tile) - 1;
  const maxRow = Math.floor(height / tile) - 1;

  it('ships four columns and four directional rows of 64px frames', () => {
    expect({ width, height, tile }).toEqual({ width: 256, height: 256, tile: 64 });
    expect(PLAYER_SPRITE_CONFIG.states.idle.rows).toEqual({
      down: 0,
      left: 1,
      right: 2,
      up: 3,
    });
  });

  it('never references a frame column outside the sheet', () => {
    Object.entries(PLAYER_SPRITE_CONFIG.states).forEach(([stateName, state]) => {
      state.frames.forEach((column) => {
        expect(column, `${stateName} frame column ${column} > max ${maxColumn}`).toBeLessThanOrEqual(maxColumn);
        expect(column).toBeGreaterThanOrEqual(0);
      });
      Object.entries(state.rows).forEach(([direction, row]) => {
        expect(row, `${stateName} row for ${direction}`).toBeLessThanOrEqual(maxRow);
        expect(row).toBeGreaterThanOrEqual(0);
      });
    });
  });

  it('keeps every combat state visible (idle, run, attack, dash, hurt defined)', () => {
    ['idle', 'run', 'attack', 'dash', 'hurt'].forEach((stateName) => {
      expect(PLAYER_SPRITE_CONFIG.states[stateName]).toBeTruthy();
      expect(PLAYER_SPRITE_CONFIG.states[stateName].frames.length).toBeGreaterThan(0);
    });
  });

  it('uses distinct stride and attack poses', () => {
    expect(PLAYER_SPRITE_CONFIG.states.run.frames).toEqual([1, 2]);
    expect(PLAYER_SPRITE_CONFIG.states.attack.frames).toEqual([0, 3]);
    expect(PLAYER_SPRITE_CONFIG.renderSize).toBe(32);
  });
});
