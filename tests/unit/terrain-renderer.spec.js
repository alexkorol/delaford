import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { nextPowerOfTwo } from '../../src/core/rendering/terrain-renderer.js';

const readSource = relativePath => readFileSync(
  fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
  'utf8',
);

describe('terrain texture sizing', () => {
  it('rounds map bakes up to a legal power-of-two texture size', () => {
    expect(nextPowerOfTwo(1)).toBe(1);
    expect(nextPowerOfTwo(2048)).toBe(2048);
    expect(nextPowerOfTwo(3456)).toBe(4096);
  });

  it('does not bake flat wall copies beneath raised terrain', () => {
    const terrainRenderer = readSource('src/core/rendering/terrain-renderer.js');
    const perspectiveRenderer = readSource('src/core/rendering/perspective-renderer.js');
    const map = readSource('src/core/map.js');
    const gameCanvas = readSource('src/components/GameCanvas.vue');

    expect(perspectiveRenderer).toContain('skipBackgroundGids: WALL_GIDS');
    expect(terrainRenderer).toContain('skipBackgroundGids: this.skipBackgroundGids');
    expect(map).toContain('if (!skipBackgroundGids?.has(background))');
    expect(perspectiveRenderer).toContain('drawVerticalTerrainShadow');
    expect(perspectiveRenderer).toContain("ctx.globalCompositeOperation = 'multiply'");
    expect(gameCanvas).toContain('brightness(1.12) contrast(1.08) saturate(0.9)');
  });
});
