import { describe, expect, it } from 'vitest';

import DUNGEON_TILESET, { DUNGEON_FIRST_GID, dungeonGid, dungeonGroupGids } from '#shared/dungeon-tiles.js';
import UI from '#shared/ui.js';
import GameMap from '#server/core/map.js';

const zero = gid => gid - 1;

describe('dungeon tileset manifest', () => {
  it('starts directly after the objects tileset and has unique names', () => {
    expect(DUNGEON_FIRST_GID).toBe(541);
    expect(Object.keys(DUNGEON_TILESET.names)).toHaveLength(DUNGEON_TILESET.tileCount);
  });

  it('resolves semantic tiles', () => {
    expect(dungeonGid('stairs_up')).toBeGreaterThanOrEqual(DUNGEON_FIRST_GID);
    expect(dungeonGid('door_open')).toBeGreaterThanOrEqual(DUNGEON_FIRST_GID);
    expect(dungeonGroupGids('floor', 'stone').length).toBeGreaterThan(4);
    expect(dungeonGroupGids('wall', 'crypt').length).toBeGreaterThan(4);
    expect(dungeonGid('nonexistent_tile')).toBe(0);
  });
});

describe('tileWalkable with dungeon gids', () => {
  it('keeps legacy terrain/objects semantics', () => {
    // terrain: 0-based id 31 is in the blocked list (ocean band)
    expect(UI.tileWalkable(31)).toBe(false);
    expect(UI.tileWalkable(zero(32))).toBe(false); // gid 32 == the ocean tile
    // no tile on a layer is walkable
    expect(UI.tileWalkable(-1)).toBe(true);
    expect(UI.tileWalkable(-1, 'foreground')).toBe(true);
    // objects local 36 is in the walkable list -> zero-based global 252+36
    expect(UI.tileWalkable(252 + 36, 'foreground')).toBe(true);
    // objects local 280 is in the blocked list
    expect(UI.tileWalkable(252 + 280, 'foreground')).toBe(false);
  });

  it('handles dungeon floors, walls and furniture', () => {
    const floor = dungeonGroupGids('floor', 'stone')[0];
    const wall = dungeonGroupGids('wall', 'stone')[0];
    const statue = dungeonGroupGids('decor', 'statue_angel')[0];
    const stairs = dungeonGid('stairs_up');

    expect(UI.tileWalkable(zero(floor))).toBe(true);
    expect(UI.tileWalkable(zero(wall))).toBe(false);
    expect(UI.tileWalkable(zero(statue), 'foreground')).toBe(false);
    expect(UI.tileWalkable(zero(stairs), 'foreground')).toBe(true);
  });
});

describe('generateInstance themes', () => {
  const walkableAt = (map, index) => {
    const bg = UI.tileWalkable(map.background[index] - 1);
    const fgGid = map.foreground[index];
    const fg = fgGid ? UI.tileWalkable(fgGid - 1, 'foreground') : true;
    return bg && fg;
  };

  it('builds a fully dungeon-tiled, connected instance', async () => {
    const generation = await GameMap.generateInstance({ seed: 1234, template: 'dungeon' });
    const { map, metadata } = generation;
    const width = 200;

    expect(metadata.theme).toBe('stone');
    expect(map.background).toHaveLength(200 * 200);

    // every background tile is from the dungeon tileset
    const outOfRange = map.background.filter(gid => gid < DUNGEON_FIRST_GID);
    expect(outOfRange).toHaveLength(0);

    // entry stairs sit on the first room centre; spawn points surround them
    const entry = metadata.stairsUp;
    expect(map.foreground[(entry.y * width) + entry.x]).toBe(dungeonGid('stairs_up'));
    expect(metadata.spawnPoints.length).toBeGreaterThan(0);
    metadata.spawnPoints.forEach((spawn) => {
      expect(spawn.x === entry.x && spawn.y === entry.y).toBe(false);
      expect(Math.abs(spawn.x - entry.x) + Math.abs(spawn.y - entry.y)).toBe(1);
    });

    // descent stairs are recorded and placed in the last room
    const exit = metadata.stairsDown;
    expect(exit).toBeTruthy();
    expect(map.foreground[(exit.y * width) + exit.x]).toBe(dungeonGid('stairs_down'));

    // BFS from the entry: every room centre must be reachable
    const start = (entry.y * width) + entry.x;
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.pop();
      const x = cur % width;
      const y = Math.floor(cur / width);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= width) return;
        const ni = (ny * width) + nx;
        if (!seen.has(ni) && walkableAt(map, ni)) {
          seen.add(ni);
          queue.push(ni);
        }
      });
    }

    metadata.roomCentres.forEach((room) => {
      expect(seen.has((room.y * width) + room.x)).toBe(true);
    });
  });

  it('is deterministic for a given seed', async () => {
    const a = await GameMap.generateInstance({ seed: 99, template: 'crypt' });
    const b = await GameMap.generateInstance({ seed: 99, template: 'crypt' });
    expect(a.map.background).toEqual(b.map.background);
    expect(a.map.foreground).toEqual(b.map.foreground);
    expect(a.metadata.theme).toBe('crypt');
  });

  it('supports every declared theme without leaking town tiles', async () => {
    const themes = ['dungeon', 'crypt', 'sand', 'volcanic', 'marsh'];
    await Promise.all(themes.map(async (template) => {
      const { map, metadata } = await GameMap.generateInstance({ seed: 7, template });
      expect(metadata.theme).toBeTruthy();
      expect(map.background.every(gid => gid >= DUNGEON_FIRST_GID)).toBe(true);
    }));
  });
});
