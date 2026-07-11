/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

import { PLAYER_SPRITE_CONFIG } from '@/core/config/animation.js';

// Regression: the human sprite sheet is a single 32x32 frame. Animation states
// that referenced columns 1/2 sampled outside the image and made the character
// flicker and vanish while acting. Every frame must stay within the sheet.

const pngDimensions = (path) => {
  const buffer = readFileSync(path);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
};

describe('player animation frames stay within the sprite sheet', () => {
  const spritePath = fileURLToPath(
    new URL('../../src/assets/graphics/actors/players/human.png', import.meta.url),
  );
  const { width, height } = pngDimensions(spritePath);
  const tile = PLAYER_SPRITE_CONFIG.tileSize;
  const maxColumn = Math.floor(width / tile) - 1;
  const maxRow = Math.floor(height / tile) - 1;

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

  it('composes worn equipment and attack reach above the actor sprite', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../src/core/map.js', import.meta.url)),
      'utf8',
    );

    expect(source).toContain('drawPaperdoll(ctx, actor');
    expect(source).toContain('wear.right_hand');
    expect(source).toContain('drawAttackEffects()');
    expect(source).toContain("effect.style === 'stab'");
    expect(source).toContain("effect.style === 'crush'");
  });
});
