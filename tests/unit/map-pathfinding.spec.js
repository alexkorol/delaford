/** @vitest-environment node */

import { afterEach, describe, expect, it } from 'vitest';
import PF from 'pathfinding';

import Map from '#server/core/map.js';
import world from '#server/core/world.js';

describe('resource pathfinding', () => {
  afterEach(() => {
    world._players = [];
  });

  it('paths to a walkable neighbour when the interaction tile is blocked', async () => {
    const grid = new PF.Grid(5, 5);
    grid.setWalkableAt(2, 2, false);
    const player = {
      path: {
        center: { x: 1, y: 2 },
        grid,
        finder: new PF.AStarFinder({ allowDiagonal: true }),
      },
    };
    world._players = [player];

    await expect(Map.findQuickestPath(2, 2, 0)).resolves.toEqual([]);
    await expect(Map.findQuickestPath(2, 2, 0, { stopAdjacent: true }))
      .resolves.toEqual([[1, 2]]);
  });
});
