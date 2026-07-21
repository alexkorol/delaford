import { describe, expect, it } from 'vitest';

import GameMap from '../../src/core/map.js';

describe('continuous player camera', () => {
  it('keeps the tile crop integral while the player occupies an off-grid position', () => {
    const map = Object.create(GameMap.prototype);
    map.config = {
      map: {
        viewport: { x: 24, y: 15 },
        tileset: { tile: { width: 32 } },
      },
    };
    map.player = { x: 10.333333, y: 20.235702 };

    const metrics = map.getViewportMetrics();

    expect(metrics.tileCrop).toEqual({ x: -2, y: 13 });
    expect(Number.isInteger(metrics.tileCrop.x)).toBe(true);
    expect(Number.isInteger(metrics.tileCrop.y)).toBe(true);
  });
});
