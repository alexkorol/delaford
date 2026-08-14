/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import GameMap from '#server/core/map.js';
import { dungeonGroupGids } from '#shared/dungeon-tiles.js';

// Focused coverage for the carve-bounds tracking added to the generation hot
// path: the optional bounds argument must record exactly the carved spans and
// must never change the carved tiles, decorateInstance's wall pass must
// produce identical layers whether it scans the full grid or only the
// recorded carve region, and generateInstance must never hand out shared
// mutable output between runs.
const WIDTH = 24;
const HEIGHT = 24;
const wallPool = dungeonGroupGids('wall', 'stone');
const floorPool = dungeonGroupGids('floor', 'stone');
const wallFill = wallPool[0];

const makeLayers = () => ({
  background: new Array(WIDTH * HEIGHT).fill(wallFill),
  foreground: new Array(WIDTH * HEIGHT).fill(0),
});

const makeBounds = () => ({
  minX: Infinity,
  minY: Infinity,
  maxX: -Infinity,
  maxY: -Infinity,
  mapWidth: WIDTH,
  rowMin: new Int32Array(HEIGHT).fill(WIDTH),
  rowMax: new Int32Array(HEIGHT).fill(-1),
});

const floorPicker = rng => () => floorPool[Math.floor(rng() * floorPool.length)];

describe('carve bounds tracking', () => {
  it('carves identical room tiles with and without a bounds object', () => {
    const withBounds = makeLayers();
    const withoutBounds = makeLayers();
    const bounds = makeBounds();
    const rngA = GameMap.createSeededGenerator(42);
    const rngB = GameMap.createSeededGenerator(42);

    GameMap.carveRoom(
      withBounds.background, withBounds.foreground, 6, 5, 4, 3, floorPicker(rngA), rngA, bounds,
    );
    GameMap.carveRoom(
      withoutBounds.background, withoutBounds.foreground, 6, 5, 4, 3, floorPicker(rngB), rngB,
    );

    expect(withBounds.background).toEqual(withoutBounds.background);
    expect(withBounds.foreground).toEqual(withoutBounds.foreground);
    expect(bounds.minX).toBe(4);
    expect(bounds.minY).toBe(3);
    expect(bounds.maxX).toBe(9);
    expect(bounds.maxY).toBe(7);
    for (let row = 3; row <= 7; row += 1) {
      expect(bounds.rowMin[row]).toBe(4);
      expect(bounds.rowMax[row]).toBe(9);
    }
    expect(bounds.rowMax[2]).toBe(-1);
    expect(bounds.rowMax[8]).toBe(-1);
  });

  it('records both corridor spans and carves identical tiles', () => {
    const withBounds = makeLayers();
    const withoutBounds = makeLayers();
    const bounds = makeBounds();
    const rngA = GameMap.createSeededGenerator(7);
    const rngB = GameMap.createSeededGenerator(7);
    const from = { x: 5, y: 5 };
    const to = { x: 18, y: 14 };

    GameMap.carveCorridor(
      withBounds.background, withBounds.foreground, from, to, 3, floorPicker(rngA), rngA, bounds,
    );
    GameMap.carveCorridor(
      withoutBounds.background, withoutBounds.foreground, from, to, 3, floorPicker(rngB), rngB,
    );

    expect(withBounds.background).toEqual(withoutBounds.background);
    expect(withBounds.foreground).toEqual(withoutBounds.foreground);
    // Row span (cols 5..18 on rows 4..6) plus column span (cols 17..19 on rows 5..14).
    expect(bounds.minX).toBe(5);
    expect(bounds.minY).toBe(4);
    expect(bounds.maxX).toBe(19);
    expect(bounds.maxY).toBe(14);
    expect(bounds.rowMin[4]).toBe(5);
    expect(bounds.rowMax[4]).toBe(18);
    expect(bounds.rowMin[10]).toBe(17);
    expect(bounds.rowMax[10]).toBe(19);
    expect(bounds.rowMax[3]).toBe(-1);
    // Every carved cell lies inside the recorded span for its row.
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        if (withBounds.background[(y * WIDTH) + x] !== wallFill) {
          expect(x).toBeGreaterThanOrEqual(bounds.rowMin[y]);
          expect(x).toBeLessThanOrEqual(bounds.rowMax[y]);
        }
      }
    }
  });
});

describe('decorateInstance carve-bounds scan', () => {
  const buildCarved = (seed, bounds) => {
    const layers = makeLayers();
    const rng = GameMap.createSeededGenerator(seed);
    GameMap.carveRoom(layers.background, layers.foreground, 8, 7, 4, 4, floorPicker(rng), rng, bounds);
    GameMap.carveRoom(layers.background, layers.foreground, 7, 6, 13, 12, floorPicker(rng), rng, bounds);
    return layers;
  };

  const decorate = (layers, seed, carveBounds) => GameMap.decorateInstance({
    background: layers.background,
    foreground: layers.foreground,
    width: WIDTH,
    height: HEIGHT,
    rng: GameMap.createSeededGenerator(seed),
    wallFill,
    wallPool,
    decorPool: dungeonGroupGids('decor', 'statue_angel'),
    treePool: [],
    theme: { water: false },
    denseDecor: false,
    roomRects: [
      { x: 4, y: 4, width: 8, height: 7 },
      { x: 13, y: 12, width: 7, height: 6 },
    ],
    carvedRooms: [{ x: 8, y: 7 }, { x: 16, y: 15 }],
    carveBounds,
  });

  it('matches the full-grid scan tile-for-tile when given exact carve bounds', () => {
    const fullLayers = buildCarved(11, null);
    decorate(fullLayers, 99, null);

    const tightBounds = makeBounds();
    const tightLayers = buildCarved(11, tightBounds);
    decorate(tightLayers, 99, tightBounds);

    expect(tightLayers.background).toEqual(fullLayers.background);
    expect(tightLayers.foreground).toEqual(fullLayers.foreground);
  });
});

describe('generateInstance output isolation', () => {
  it('never shares mutable output between runs', async () => {
    const input = { seed: 4242, template: 'dungeon', layout: 'warren', depth: 1 };
    const first = await GameMap.generateInstance(input);
    const snapshot = JSON.parse(JSON.stringify({
      map: first.map,
      metadata: first.metadata,
      monsters: first.monsters,
    }));

    first.map.background[0] = -1;
    first.map.foreground[0] = -1;
    first.monsters[0].name = 'corrupted';
    first.metadata.spawnPoints.length = 0;
    first.items[0].name = 'corrupted treasure';

    const second = await GameMap.generateInstance(input);
    expect({
      map: second.map,
      metadata: second.metadata,
      monsters: second.monsters,
    }).toEqual(snapshot);
    expect(second.items[0].name).not.toBe('corrupted treasure');
    expect(second.items[0].uuid).not.toBe(first.items[0].uuid);

    second.map.background[0] = -2;
    second.monsters[0].name = 'second corruption';
    second.items[0].name = 'second corrupted treasure';
    const third = await GameMap.generateInstance(input);
    expect({
      map: third.map,
      metadata: third.metadata,
      monsters: third.monsters,
    }).toEqual(snapshot);
    expect(third.items[0].name).not.toBe('second corrupted treasure');
    expect(third.items[0].uuid).not.toBe(second.items[0].uuid);
  });
});
