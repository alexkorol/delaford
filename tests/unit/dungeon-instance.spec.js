import { describe, expect, it } from 'vitest';

import DUNGEON_TILESET, { DUNGEON_FIRST_GID, dungeonGid, dungeonGroupGids } from '#shared/dungeon-tiles.js';
import UI from '#shared/ui.js';
import GameMap from '#server/core/map.js';
import { INSTANCE_MONSTER_COLUMNS } from '#shared/actor-graphics.js';

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
    const themes = ['dungeon', 'crypt', 'sand', 'volcanic', 'marsh', 'grove', 'wilds'];
    await Promise.all(themes.map(async (template) => {
      const { map, metadata } = await GameMap.generateInstance({ seed: 7, template });
      expect(metadata.theme).toBeTruthy();
      expect(map.background.every(gid => gid >= DUNGEON_FIRST_GID)).toBe(true);
    }));
  });

  it('gives biomes distinct combat-role profiles and explicit rare modifiers', async () => {
    const crypt = await GameMap.generateInstance({ seed: 20260711, template: 'crypt', depth: 1 });
    const marsh = await GameMap.generateInstance({ seed: 20260711, template: 'marsh', depth: 1 });
    const count = (generation, role) => generation.monsters
      .filter(monster => monster.rarity !== 'elite' && monster.behaviour.type === role).length;

    expect(count(crypt, 'melee')).toBeGreaterThan(count(crypt, 'ranged'));
    expect(count(marsh, 'ranged')).toBeGreaterThan(count(crypt, 'ranged'));
    expect(count(crypt, 'buffer')).toBeGreaterThan(0);
    expect(count(marsh, 'buffer')).toBeGreaterThan(0);

    const rares = [...crypt.monsters, ...marsh.monsters]
      .filter(monster => monster.rarity === 'rare');
    expect(rares.length).toBeGreaterThan(0);
    rares.forEach((monster) => {
      expect(monster.modifiers).toHaveLength(1);
      expect(['thick-hide', 'frenzied']).toContain(monster.modifiers[0].id);
    });
  });

  it('raises the rare-enemy share with endless depth', async () => {
    const shallow = await GameMap.generateInstance({ seed: 8675309, template: 'dungeon', depth: 1 });
    const deep = await GameMap.generateInstance({ seed: 8675309, template: 'dungeon', depth: 6 });
    const rareCount = generation => generation.monsters
      .filter(monster => monster.rarity === 'rare').length;

    expect(rareCount(deep)).toBeGreaterThan(rareCount(shallow));
  });

  it('gives generated monster roles distinct silhouettes', async () => {
    const themes = ['dungeon', 'crypt', 'sand', 'volcanic', 'marsh', 'grove', 'wilds'];
    const atlasColumns = new Set(
      Object.values(INSTANCE_MONSTER_COLUMNS).flatMap(theme => Object.values(theme)),
    );
    await Promise.all(themes.map(async (template) => {
      const { monsters } = await GameMap.generateInstance({ seed: 7, template });
      const columns = new Set(monsters.map(monster => monster.graphic?.column));
      expect(columns.size, `${template} silhouette count`).toBeGreaterThanOrEqual(3);
      expect([...columns].every(column => atlasColumns.has(column))).toBe(true);
    }));
  });

  // Every room centre reachable on foot from the entry stairs. Returns the
  // count of unreachable room centres (0 == fully connected).
  const unreachableRoomCount = (map, metadata, width = 200) => {
    const start = (metadata.stairsUp.y * width) + metadata.stairsUp.x;
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
    return metadata.roomCentres.filter(r => !seen.has((r.y * width) + r.x)).length;
  };

  it('carves many rooms with short corridors, not a few big halls down long tunnels', async () => {
    // The user asked for "more rooms" and "shorter corridors". A dungeon floor
    // should read as a dense warren, not 5 rooms strung on long tunnels.
    for (const seed of [11, 22, 33, 44, 55]) {
      const { metadata } = await GameMap.generateInstance({ seed, template: 'dungeon', depth: 1 });
      expect(metadata.roomCentres.length, `seed ${seed}`).toBeGreaterThanOrEqual(9);
    }
  });

  it('generates open outdoor clearings for grove/wilds themes', async () => {
    for (const template of ['grove', 'wilds']) {
      const { map, metadata, monsters } = await GameMap.generateInstance({ seed: 4, template, depth: 1 });
      const width = 200;
      let walkable = 0;
      for (let i = 0; i < map.background.length; i += 1) if (walkableAt(map, i)) walkable += 1;
      // Outdoor floors are far more open than tight indoor dungeons.
      expect(walkable, `${template} walkable`).toBeGreaterThan(1400);
      expect(metadata.roomCentres.length, `${template} clearings`).toBeGreaterThanOrEqual(8);
      // and denser packs of monsters roam them
      expect(monsters.length, `${template} monsters`).toBeGreaterThanOrEqual(30);
    }
  });

  it('tags only declared creature identities as beasts', async () => {
    const grove = await GameMap.generateInstance({ seed: 4, template: 'grove', depth: 1 });
    const stone = await GameMap.generateInstance({ seed: 4, template: 'dungeon', depth: 1 });
    const groveBeasts = grove.monsters.filter(monster => monster.tags?.includes('beast'));

    expect(groveBeasts.length).toBeGreaterThan(0);
    expect(groveBeasts.every(monster => monster.name === 'Thornclad Stag')).toBe(true);
    expect(stone.monsters.some(monster => monster.tags?.includes('beast'))).toBe(false);
  });

  it('guarantees full connectivity across templates, seeds and depths', async () => {
    const templates = ['dungeon', 'crypt', 'marsh', 'grove', 'wilds'];
    for (const template of templates) {
      for (const seed of [101, 202, 303]) {
        for (const depth of [1, 3]) {
          const { map, metadata } = await GameMap.generateInstance({ seed, template, depth });
          expect(
            unreachableRoomCount(map, metadata),
            `${template} seed ${seed} depth ${depth}`,
          ).toBe(0);
        }
      }
    }
  });

  // Layout is an independent axis from theme (art). Any theme can pair with any
  // layout recipe, PoE-style, and the recipe alone controls the floor's shape.
  describe('layout recipes (decoupled from theme)', () => {
    const walkableCount = (map) => {
      let count = 0;
      for (let i = 0; i < map.background.length; i += 1) if (walkableAt(map, i)) count += 1;
      return count;
    };
    const entryExitSpan = (metadata) => {
      const { stairsUp: a, stairsDown: b } = metadata;
      return b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
    };

    it('defaults to warren for indoor themes and clearings for outdoor themes', async () => {
      const dungeon = await GameMap.generateInstance({ seed: 5, template: 'dungeon' });
      const grove = await GameMap.generateInstance({ seed: 5, template: 'grove' });
      expect(dungeon.metadata.layout).toBe('warren');
      expect(grove.metadata.layout).toBe('clearings');
    });

    it('lets any theme pair with any layout, recording the chosen recipe', async () => {
      for (const template of ['dungeon', 'crypt', 'grove']) {
        for (const layout of ['warren', 'clearings', 'gauntlet']) {
          const { map, metadata } = await GameMap.generateInstance({
            seed: 12, template, layout, depth: 1,
          });
          expect(metadata.layout, `${template}/${layout}`).toBe(layout);
          expect(unreachableRoomCount(map, metadata), `${template}/${layout} connectivity`).toBe(0);
        }
      }
    });

    it('builds the gauntlet as a connected line, not a compact warren', async () => {
      for (const seed of [1, 2, 3, 4, 5]) {
        const gauntlet = await GameMap.generateInstance({ seed, template: 'crypt', layout: 'gauntlet' });
        const warren = await GameMap.generateInstance({ seed, template: 'crypt', layout: 'warren' });
        // The gauntlet strings its rooms out, so the stairs down end up much
        // farther from the entry than in a compact warren.
        expect(entryExitSpan(gauntlet.metadata), `seed ${seed}`)
          .toBeGreaterThan(entryExitSpan(warren.metadata) * 1.8);
        expect(unreachableRoomCount(gauntlet.map, gauntlet.metadata), `seed ${seed}`).toBe(0);
      }
    });

    it('opens a normally-tight theme when paired with the clearings layout', async () => {
      const openCrypt = await GameMap.generateInstance({ seed: 9, template: 'crypt', layout: 'clearings' });
      const tightCrypt = await GameMap.generateInstance({ seed: 9, template: 'crypt', layout: 'warren' });
      // Same crypt art, far more open floor.
      expect(walkableCount(openCrypt.map)).toBeGreaterThan(walkableCount(tightCrypt.map) * 1.5);
      expect(unreachableRoomCount(openCrypt.map, openCrypt.metadata)).toBe(0);
    });

    it('ignores an unknown layout and falls back to the theme default', async () => {
      const { metadata } = await GameMap.generateInstance({
        seed: 3, template: 'dungeon', layout: 'not-a-real-layout',
      });
      expect(metadata.layout).toBe('warren');
    });
  });
});
