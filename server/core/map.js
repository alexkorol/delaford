import { armor, jewelry, weapons } from '#server/core/data/respawn/index.js';

import MapUtils from '#shared/map-utils.js';
import PF from 'pathfinding';
import UI from '#shared/ui.js';
import config from '#server/config.js';
import surfaceMap from '#server/maps/layers/surface.json' with { type: 'json' };
import { dungeonGid, dungeonGroupGids } from '#shared/dungeon-tiles.js';
import { instanceMonsterGraphic } from '#shared/actor-graphics.js';
import ItemFactory from './items/factory.js';
import { Shop } from './functions/index.js';
import world from './world.js';
import createWorldLayout from './world-layout.js';

const DEFAULT_INSTANCE_ROOM_COUNT = 12;
const DEFAULT_OUTDOOR_CLEARING_COUNT = 9;
const DEFAULT_CORRIDOR_WIDTH = 3;

// Layout recipes are the *shape* of a floor, kept independent of the theme
// (which is only art). Any theme can pair with any recipe, PoE-style: a crypt
// can be a tight warren OR a linear colonnade OR an open courtyard, reusing the
// same tiles. generateInstance picks a recipe from options.layout, defaulting
// to the theme's natural indoor/outdoor shape so existing callers are unchanged.
//
// The param names map 1:1 onto the placement loop: a value `foo` fed as
// `Math.floor(rng() * fooRoll) + fooBase`. Keeping the roll/base split lets the
// warren/clearings recipes reproduce the previous hard-coded numbers exactly.
const LAYOUT_RECIPES = {
  // Branching warren: many tight rooms budding off random anchors with short
  // corridors — the classic dungeon.
  warren: {
    id: 'warren',
    open: false,
    linear: false,
    anchor: 'random',
    roomCount: DEFAULT_INSTANCE_ROOM_COUNT,
    roomBase: 7,
    roomRoll: 6, // 7-12
    bandFrac: 0.30,
    gapBase: 3,
    gapRoll: 4, // 3-6: short corridor
    corridorWidth: DEFAULT_CORRIDOR_WIDTH,
    packBase: 3,
    packRoll: 3, // 3-5
    spreadFrac: 0,
  },
  // Open clearings: a few big overlapping chambers with wide links and lots of
  // scattered cover — the open field / courtyard.
  clearings: {
    id: 'clearings',
    open: true,
    linear: false,
    anchor: 'random',
    roomCount: DEFAULT_OUTDOOR_CLEARING_COUNT,
    roomBase: 14,
    roomRoll: 10, // 14-23: big clearings
    bandFrac: 0.24,
    gapBase: -2,
    gapRoll: 5, // -2..2: clearings overlap
    corridorWidth: 4,
    packBase: 6,
    packRoll: 4, // 6-9 spread across a clearing
    spreadFrac: 0.38,
  },
  // Linear gauntlet: rooms strung in a chain from entry to exit, each budding
  // off the previous one in a biased run direction — a push-through map with no
  // shortcut back to the stairs down.
  gauntlet: {
    id: 'gauntlet',
    open: false,
    linear: true,
    anchor: 'previous',
    forwardBias: true,
    angleJitter: 1.1, // radians of wander around the run axis
    roomCount: 8,
    roomBase: 8,
    roomRoll: 5, // 8-12
    bandFrac: 0.14,
    gapBase: 3,
    gapRoll: 4, // 3-6 short halls between rooms
    corridorWidth: 3,
    packBase: 4,
    packRoll: 3, // 4-6
    spreadFrac: 0,
  },
};

export const LAYOUT_IDS = Object.keys(LAYOUT_RECIPES);

// Visual themes for generated instances, built on the DCSS (RLTiles) dungeon
// tileset. Each entry lists gid pools; generation picks per-tile variants.
const INSTANCE_THEMES = {
  stone: {
    floors: () => dungeonGroupGids('floor', 'stone'),
    floorAccents: () => dungeonGroupGids('floor', 'grey'),
    walls: () => dungeonGroupGids('wall', 'stone'),
    decor: () => [
      ...dungeonGroupGids('decor', 'statue_angel'),
      ...dungeonGroupGids('decor', 'statue_archer'),
      ...dungeonGroupGids('decor', 'fountain_blue'),
      ...dungeonGroupGids('decor', 'altar_generic'),
    ],
    trees: () => [],
    water: false,
  },
  crypt: {
    floors: () => dungeonGroupGids('floor', 'crypt'),
    floorAccents: () => dungeonGroupGids('floor', 'tomb'),
    walls: () => dungeonGroupGids('wall', 'crypt'),
    decor: () => [
      ...dungeonGroupGids('decor', 'sarcophagus'),
      ...dungeonGroupGids('decor', 'altar_generic'),
      ...dungeonGroupGids('decor', 'fountain_blood'),
    ],
    trees: () => [
      ...dungeonGroupGids('tree', 'tree_dead'),
      ...dungeonGroupGids('tree', 'tree_petrified'),
    ],
    water: false,
  },
  sand: {
    floors: () => dungeonGroupGids('floor', 'sand'),
    floorAccents: () => dungeonGroupGids('floor', 'dirt'),
    walls: () => dungeonGroupGids('wall', 'sand'),
    decor: () => [
      ...dungeonGroupGids('decor', 'statue_dragon'),
      ...dungeonGroupGids('decor', 'fountain_dry'),
      ...dungeonGroupGids('decor', 'altar_generic'),
    ],
    trees: () => dungeonGroupGids('tree', 'tree_dead'),
    water: false,
  },
  volcanic: {
    floors: () => dungeonGroupGids('floor', 'volcanic'),
    floorAccents: () => dungeonGroupGids('floor', 'blood'),
    walls: () => dungeonGroupGids('wall', 'volcanic'),
    decor: () => [
      ...dungeonGroupGids('decor', 'statue_dragon'),
      ...dungeonGroupGids('decor', 'fountain_blood'),
    ],
    trees: () => dungeonGroupGids('tree', 'tree_petrified'),
    water: false,
  },
  marsh: {
    floors: () => dungeonGroupGids('floor', 'marsh'),
    floorAccents: () => dungeonGroupGids('floor', 'mud'),
    walls: () => [
      ...dungeonGroupGids('wall', 'vines'),
      ...dungeonGroupGids('wall', 'brick'),
    ],
    decor: () => [
      ...dungeonGroupGids('decor_walk', 'flowers'),
      ...dungeonGroupGids('decor', 'fountain_sparkling'),
    ],
    trees: () => dungeonGroupGids('tree', 'tree'),
    water: true,
  },
  // Outdoor themes: open clearings and tree-lines instead of tight rooms and
  // long corridors. The generator uses an open-field layout for these.
  grove: {
    outdoor: true,
    floors: () => [
      ...dungeonGroupGids('floor', 'lair'),
      ...dungeonGroupGids('floor', 'marsh'),
    ],
    floorAccents: () => dungeonGroupGids('floor', 'dirt'),
    walls: () => dungeonGroupGids('wall', 'vines'),
    decor: () => dungeonGroupGids('decor_walk', 'flowers'),
    trees: () => dungeonGroupGids('tree', 'tree'),
    water: true,
  },
  wilds: {
    outdoor: true,
    floors: () => [
      ...dungeonGroupGids('floor', 'dirt'),
      ...dungeonGroupGids('floor', 'lair'),
    ],
    floorAccents: () => dungeonGroupGids('floor', 'mud'),
    walls: () => [
      ...dungeonGroupGids('wall', 'vines'),
      ...dungeonGroupGids('wall', 'brick'),
    ],
    decor: () => dungeonGroupGids('decor_walk', 'flowers'),
    trees: () => [
      ...dungeonGroupGids('tree', 'tree'),
      ...dungeonGroupGids('tree', 'tree_dead'),
    ],
    water: true,
  },
};

const TEMPLATE_THEMES = {
  dungeon: 'stone',
  stone: 'stone',
  crypt: 'crypt',
  tomb: 'crypt',
  sand: 'sand',
  desert: 'sand',
  volcanic: 'volcanic',
  hell: 'volcanic',
  marsh: 'marsh',
  swamp: 'marsh',
  grove: 'grove',
  forest: 'grove',
  wilds: 'wilds',
  wilderness: 'wilds',
};

// Monster identities per theme so each floor reads differently.
export const THEME_MONSTERS = {
  stone: {
    melee: 'Dread Vanguard',
    ranged: 'Ashen Marksman',
    support: 'Celestial Channeler',
    boss: 'Warden of the Deep',
  },
  crypt: {
    melee: 'Risen Blademaster',
    ranged: 'Gravebolt Archer',
    support: 'Bone Chorister',
    boss: 'The Pale Sovereign',
  },
  sand: {
    melee: 'Dune Reaver',
    ranged: 'Sirocco Slinger',
    support: 'Mirage Priest',
    boss: 'Tomb King Ahmenet',
  },
  volcanic: {
    melee: 'Cinder Brute',
    ranged: 'Magma Spitter',
    support: 'Flamecaller',
    boss: 'Furnace Tyrant',
  },
  marsh: {
    melee: 'Bog Lurker',
    ranged: 'Fen Dartcaster',
    support: 'Mire Shaman',
    boss: 'The Rotfather',
  },
  grove: {
    melee: 'Thornclad Stag',
    ranged: 'Bramble Slinger',
    support: 'Grovekeeper',
    boss: 'The Elder Oak',
  },
  wilds: {
    melee: 'Wild Marauder',
    ranged: 'Barrow Archer',
    support: 'Beast Whisperer',
    boss: 'Alpha of the Wilds',
  },
};

// Creature tags are combat truth, separate from role/archetype. Only named
// identities that are plainly beasts receive Beastbane damage; humanoids,
// undead, plants, and spirits remain untagged even when they share AI.
export const THEME_MONSTER_TAGS = {
  volcanic: { ranged: ['beast'] },
  marsh: { melee: ['beast'] },
  grove: { melee: ['beast'] },
  wilds: { boss: ['beast'] },
};

// Treasure-room gear pools; deeper floors roll better bases.
const INSTANCE_LOOT_TIERS = [
  { minDepth: 1, gear: ['bronze-sword', 'bronze-dagger', 'bronze-mace', 'wooden-shield', 'leather-body', 'bronze-helm'] },
  { minDepth: 3, gear: ['iron-sword', 'iron-battleaxe', 'iron-chainmail', 'bronze-shield', 'hard-leather-body', 'shortbow'] },
  { minDepth: 5, gear: ['steel-sword', 'steel-battleaxe', 'steel-warhammer', 'ranger-body', 'longbow', 'gold-ring'] },
];

const gearPoolForDepth = (depth) => {
  const eligible = INSTANCE_LOOT_TIERS.filter(tier => depth >= tier.minDepth);
  return eligible.length ? eligible[eligible.length - 1].gear : INSTANCE_LOOT_TIERS[0].gear;
};

class Map {
  constructor(level) {
    // Getters & Setters
    this.players = [];
    this.level = level;

    this.background = world.map.background;
    this.foreground = world.map.foreground;

    this.setUp();
  }

  static createSeededGenerator(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  static normaliseSeed(seed) {
    if (Number.isFinite(seed)) {
      return Math.abs(Math.floor(seed)) || Date.now();
    }

    if (typeof seed === 'string') {
      let hash = 0;
      for (let i = 0; i < seed.length; i += 1) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash) || Date.now();
    }

    return Date.now();
  }

  static pickTile(tileId, rng) {
    if (typeof tileId === 'function') {
      return tileId();
    }
    if (Array.isArray(tileId)) {
      return tileId[Math.floor((rng ? rng() : Math.random()) * tileId.length)] || tileId[0];
    }
    return tileId;
  }

  static carveRoom(background, foreground, width, height, x, y, tileId, rng) {
    for (let row = y; row < y + height; row += 1) {
      for (let col = x; col < x + width; col += 1) {
        const index = (row * surfaceMap.width) + col;
        background[index] = Map.pickTile(tileId, rng);
        foreground[index] = 0;
      }
    }
  }

  static carveCorridor(background, foreground, from, to, corridorWidth, tileId, rng) {
    const minX = Math.min(from.x, to.x);
    const maxX = Math.max(from.x, to.x);
    const minY = Math.min(from.y, to.y);
    const maxY = Math.max(from.y, to.y);

    const carveColumn = (xCoord) => {
      for (let row = minY; row <= maxY; row += 1) {
        for (let offset = -Math.floor(corridorWidth / 2); offset <= Math.floor(corridorWidth / 2); offset += 1) {
          const col = xCoord + offset;
          if (col < 0 || col >= surfaceMap.width || row < 0 || row >= surfaceMap.height) {
            continue;
          }

          const index = (row * surfaceMap.width) + col;
          background[index] = Map.pickTile(tileId, rng);
          foreground[index] = 0;
        }
      }
    };

    const carveRow = (yCoord) => {
      for (let col = minX; col <= maxX; col += 1) {
        for (let offset = -Math.floor(corridorWidth / 2); offset <= Math.floor(corridorWidth / 2); offset += 1) {
          const row = yCoord + offset;
          if (col < 0 || col >= surfaceMap.width || row < 0 || row >= surfaceMap.height) {
            continue;
          }

          const index = (row * surfaceMap.width) + col;
          background[index] = Map.pickTile(tileId, rng);
          foreground[index] = 0;
        }
      }
    };

    carveRow(from.y);
    carveColumn(to.x);
  }

  /**
   * Dress a carved instance: varied wall faces around open space, entry and
   * exit stairs, open doors where corridors meet rooms, and themed decor.
   */
  static decorateInstance({
    background,
    foreground,
    width,
    height,
    rng,
    wallFill,
    wallPool,
    decorPool,
    treePool,
    theme,
    denseDecor,
    roomRects,
    carvedRooms,
  }) {
    const idx = (x, y) => (y * width) + x;
    const isFloor = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) {
        return false;
      }
      const tile = background[idx(x, y)];
      return tile !== wallFill && !wallPool.includes(tile);
    };

    // Wall pass: any solid cell touching open space gets a varied wall face.
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (background[idx(x, y)] !== wallFill) {
          continue;
        }
        let touchesFloor = false;
        for (let dy = -1; dy <= 1 && !touchesFloor; dy += 1) {
          for (let dx = -1; dx <= 1 && !touchesFloor; dx += 1) {
            if ((dx || dy) && isFloor(x + dx, y + dy)) {
              touchesFloor = true;
            }
          }
        }
        if (touchesFloor && wallPool.length > 1) {
          background[idx(x, y)] = wallPool[Math.floor(rng() * wallPool.length)];
        }
      }
    }

    // Door pass: room-perimeter floor cells that connect to outside floor.
    const doorGid = dungeonGid('door_open') || dungeonGid('door_broken');
    if (doorGid) {
      roomRects.forEach((room) => {
        let placed = 0;
        for (let x = room.x; x < room.x + room.width && placed < 2; x += 1) {
          [[x, room.y - 1, x, room.y], [x, room.y + room.height, x, room.y + room.height - 1]]
            .forEach(([ox, oy, ix, iy]) => {
              if (placed < 2 && isFloor(ox, oy) && isFloor(ix, iy)
                && !foreground[idx(ix, iy)] && rng() < 0.6) {
                foreground[idx(ix, iy)] = doorGid;
                placed += 1;
              }
            });
        }
      });
    }

    // Stairs: entry in the first room, descent in the last.
    const entry = carvedRooms[0];
    const exit = carvedRooms[carvedRooms.length - 1];
    const stairsUp = dungeonGid('stairs_up');
    const stairsDown = dungeonGid('stairs_down');
    if (entry && stairsUp) {
      foreground[idx(entry.x, entry.y)] = stairsUp;
    }
    if (exit && exit !== entry && stairsDown) {
      foreground[idx(exit.x, exit.y)] = stairsDown;
    }

    // Decor pass: a little themed furniture per room, off the spawn room.
    roomRects.forEach((room, roomIndex) => {
      const pools = [decorPool, treePool].filter((pool) => pool.length);
      if (!pools.length) {
        return;
      }
      // Open layouts are large and want scattered cover (a grove of trees), so
      // seed many more pieces per clearing; tight rooms stay sparse so the floor
      // reads clear. Density follows the layout recipe, not the theme, so an
      // open crypt gets scattered cover too.
      const pieces = denseDecor
        ? Math.floor((room.width * room.height) / 26) + 2
        : 1 + Math.floor(rng() * 2);
      // Keep a clear zone around the room centre: monsters spawn there (ring
      // offsets up to 2 tiles) and the stairs sit on the centre, so blocking
      // decor there would trap spawns and break floor connectivity.
      const centreX = Math.floor(room.x + (room.width / 2));
      const centreY = Math.floor(room.y + (room.height / 2));
      for (let i = 0; i < pieces; i += 1) {
        const pool = pools[Math.floor(rng() * pools.length)];
        const x = room.x + 1 + Math.floor(rng() * Math.max(1, room.width - 2));
        const y = room.y + 1 + Math.floor(rng() * Math.max(1, room.height - 2));
        const onSpawn = roomIndex === 0
          && Math.abs(x - entry.x) <= 2 && Math.abs(y - entry.y) <= 2;
        const onCentre = Math.abs(x - centreX) <= 2 && Math.abs(y - centreY) <= 2;
        if (isFloor(x, y) && !foreground[idx(x, y)] && !onSpawn && !onCentre) {
          foreground[idx(x, y)] = pool[Math.floor(rng() * pool.length)];
        }
      }

      // Marsh/outdoor themes get small water pools in roomy chambers. Never
      // over the centre clear-zone — water is non-walkable and would trap the
      // pack spawn / stairs and break connectivity (same trap as blocking
      // decor). Retry a few placements to find a spot clear of the centre.
      if (theme.water && room.width >= 9 && room.height >= 9 && rng() < 0.7) {
        const waterGid = dungeonGroupGids('liquid', 'water_shallow')[0];
        if (waterGid) {
          for (let attempt = 0; attempt < 6; attempt += 1) {
            const px = room.x + 2 + Math.floor(rng() * (room.width - 5));
            const py = room.y + 2 + Math.floor(rng() * (room.height - 5));
            const poolClearOfCentre = Math.abs((px + 0.5) - centreX) > 3
              || Math.abs((py + 0.5) - centreY) > 3;
            if (!poolClearOfCentre) {
              continue;
            }
            for (let dy = 0; dy < 2; dy += 1) {
              for (let dx = 0; dx < 2; dx += 1) {
                if (!foreground[idx(px + dx, py + dy)]) {
                  background[idx(px + dx, py + dy)] = waterGid;
                }
              }
            }
            break;
          }
        }
      }
    });
  }

  static async generateInstance(options = {}) {
    const template = options.template || 'dungeon';
    const depth = Math.max(1, Math.floor(options.depth || 1));
    const baseThemeName = options.theme
      || TEMPLATE_THEMES[String(template).toLowerCase()]
      || 'stone';

    // Deeper floors rotate through the theme list, starting from the
    // template's theme on floor 1. Indoor and outdoor themes rotate within
    // their own pools so an outdoor zone stays outdoor as you descend (and an
    // indoor dungeon never suddenly opens into a forest floor).
    const baseIsOutdoor = !!(INSTANCE_THEMES[baseThemeName] || {}).outdoor;
    const themeNames = Object.keys(INSTANCE_THEMES)
      .filter(name => !!INSTANCE_THEMES[name].outdoor === baseIsOutdoor);
    const baseThemeIndex = Math.max(0, themeNames.indexOf(baseThemeName));
    const themeName = themeNames[(baseThemeIndex + (depth - 1)) % themeNames.length];
    const theme = INSTANCE_THEMES[themeName] || INSTANCE_THEMES.stone;

    // Layout is a separate axis from theme (art). Pick the requested recipe, or
    // default to the theme's natural shape — outdoor themes open into clearings,
    // indoor themes into a warren. This keeps every existing caller unchanged.
    const layoutId = options.layout && LAYOUT_RECIPES[options.layout]
      ? options.layout
      : (baseIsOutdoor ? 'clearings' : 'warren');
    const recipe = LAYOUT_RECIPES[layoutId];

    // Each floor gets its own deterministic seed derived from the base
    const baseSeed = Map.normaliseSeed(options.seed);
    const seed = Map.normaliseSeed(baseSeed + ((depth - 1) * 7919));

    const width = surfaceMap.width || config.map.size.x;
    const height = surfaceMap.height || config.map.size.y;
    const rng = Map.createSeededGenerator(seed);

    // Resolve theme gid pools once
    const floorPool = theme.floors();
    const accentPool = theme.floorAccents();
    const wallPool = theme.walls();
    const decorPool = theme.decor();
    const treePool = theme.trees();
    const wallFill = wallPool[0] || 0;

    // Solid rock everywhere; rooms and corridors are carved out of it.
    const background = new Array(width * height).fill(wallFill);
    const foreground = new Array(width * height).fill(0);

    const floorPicker = () => {
      const pool = accentPool.length && rng() < 0.12 ? accentPool : floorPool;
      return pool[Math.floor(rng() * pool.length)] || floorPool[0];
    };

    // The floor's shape comes entirely from the recipe now (see LAYOUT_RECIPES).
    const rooms = Math.max(1, options.rooms || recipe.roomCount);
    const carvedRooms = [];
    const roomRects = [];
    const anchorOf = [];

    // A central band keeps the whole floor compact — corridors are short because
    // every room is placed within a few tiles of a room already down. A gauntlet
    // uses a wider band so its chain of rooms can stretch across the map.
    const bandFrac = recipe.bandFrac;
    const bandMinX = Math.floor(width * bandFrac);
    const bandMaxX = Math.floor(width * (1 - bandFrac));
    const bandMinY = Math.floor(height * bandFrac);
    const bandMaxY = Math.floor(height * (1 - bandFrac));
    const clampV = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

    // Linear gauntlets bud rooms along one wandering run direction; other
    // recipes bud in any direction. (Falsy recipe.forwardBias consumes no rng,
    // so warren/clearings keep their exact prior tile output.)
    const runAngle = recipe.forwardBias ? rng() * Math.PI * 2 : 0;

    for (let index = 0; index < rooms; index += 1) {
      const roomWidth = Math.floor(rng() * recipe.roomRoll) + recipe.roomBase;
      const roomHeight = Math.floor(rng() * recipe.roomRoll) + recipe.roomBase;

      let originX;
      let originY;
      if (index === 0) {
        originX = Math.floor((bandMinX + bandMaxX) / 2 - (roomWidth / 2));
        originY = Math.floor((bandMinY + bandMaxY) / 2 - (roomHeight / 2));
        anchorOf.push(-1);
      } else {
        // Grow the floor by budding each new room off an already-placed one,
        // only a short gap away. A warren/clearing picks a random anchor; a
        // gauntlet always chains off the previous room to stay a line.
        const anchorIndex = recipe.anchor === 'previous'
          ? index - 1
          : Math.floor(rng() * carvedRooms.length);
        const anchor = carvedRooms[anchorIndex];
        const angle = recipe.forwardBias
          ? runAngle + ((rng() - 0.5) * recipe.angleJitter)
          : rng() * Math.PI * 2;
        const gap = Math.floor(rng() * recipe.gapRoll) + recipe.gapBase;
        const dist = ((roomWidth + roomHeight) / 2) + gap;
        originX = Math.round(anchor.x + (Math.cos(angle) * dist) - (roomWidth / 2));
        originY = Math.round(anchor.y + (Math.sin(angle) * dist) - (roomHeight / 2));
        anchorOf.push(anchorIndex);
      }

      originX = clampV(originX, Math.max(1, bandMinX), Math.min(width - roomWidth - 1, bandMaxX));
      originY = clampV(originY, Math.max(1, bandMinY), Math.min(height - roomHeight - 1, bandMaxY));

      Map.carveRoom(background, foreground, roomWidth, roomHeight, originX, originY, floorPicker, rng);

      const center = {
        x: Math.floor(originX + (roomWidth / 2)),
        y: Math.floor(originY + (roomHeight / 2)),
      };
      carvedRooms.push(center);
      roomRects.push({
        x: originX, y: originY, width: roomWidth, height: roomHeight,
      });
    }

    if (carvedRooms.length > 1) {
      // Corridor width comes from the recipe (wide for merging clearings,
      // narrow for tight rooms). Either way links are short because rooms bud
      // off nearby anchors.
      const corridorWidth = Math.max(2, options.corridorWidth || recipe.corridorWidth);

      // Connect each room to the anchor it budded from — guarantees the floor
      // is one connected piece with only short links.
      for (let index = 1; index < carvedRooms.length; index += 1) {
        const anchorIndex = anchorOf[index] >= 0 ? anchorOf[index] : index - 1;
        Map.carveCorridor(
          background,
          foreground,
          carvedRooms[anchorIndex],
          carvedRooms[index],
          corridorWidth,
          floorPicker,
          rng,
        );
      }

      // One extra loop link so there is more than one route through the floor —
      // skipped for linear gauntlets, which are meant to be a single push with
      // no shortcut back to the stairs down.
      if (!recipe.linear && carvedRooms.length > 3) {
        const loopFrom = 1 + Math.floor(rng() * (carvedRooms.length - 3));
        Map.carveCorridor(
          background,
          foreground,
          carvedRooms[loopFrom],
          carvedRooms[carvedRooms.length - 1],
          corridorWidth,
          floorPicker,
          rng,
        );
      }
    }

    Map.decorateInstance({
      background,
      foreground,
      width,
      height,
      rng,
      wallFill,
      wallPool,
      decorPool,
      treePool,
      theme,
      denseDecor: recipe.open,
      roomRects,
      carvedRooms,
    });

    // Guarantee connectivity: decor, water, or clamped overlaps can block a
    // path after carving, so flood-fill from the entry and carve a clean
    // corridor to any unreachable room centre. Without this a pack, the
    // treasure, or the stairs down can end up sealed off.
    if (carvedRooms.length > 1) {
      const cIdx = (x, y) => (y * width) + x;
      const inBounds = (x, y) => x >= 0 && y >= 0 && x < width && y < height;
      const walkAt = (x, y) => {
        if (!inBounds(x, y)) {
          return false;
        }
        const bgOk = UI.tileWalkable(background[cIdx(x, y)] - 1);
        const fgGid = foreground[cIdx(x, y)];
        return bgOk && (!fgGid || UI.tileWalkable(fgGid - 1, 'foreground'));
      };
      const clearTile = (x, y) => {
        if (!inBounds(x, y)) {
          return;
        }
        background[cIdx(x, y)] = floorPicker();
        const fgGid = foreground[cIdx(x, y)];
        if (fgGid && !UI.tileWalkable(fgGid - 1, 'foreground')) {
          foreground[cIdx(x, y)] = 0;
        }
      };
      const carveClearLine = (a, b) => {
        let x = a.x;
        let y = a.y;
        let guard = 0;
        const maxSteps = width + height;
        while ((x !== b.x || y !== b.y) && guard < maxSteps) {
          guard += 1;
          clearTile(x, y);
          clearTile(x + 1, y);
          clearTile(x, y + 1);
          if (x < b.x) x += 1; else if (x > b.x) x -= 1;
          if (y < b.y) y += 1; else if (y > b.y) y -= 1;
        }
        clearTile(b.x, b.y);
        clearTile(b.x + 1, b.y);
      };
      const floodFrom = (start) => {
        const seen = new Set([cIdx(start.x, start.y)]);
        const queue = [start];
        while (queue.length) {
          const cur = queue.pop();
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
            const nx = cur.x + dx;
            const ny = cur.y + dy;
            const ni = cIdx(nx, ny);
            if (!seen.has(ni) && walkAt(nx, ny)) {
              seen.add(ni);
              queue.push({ x: nx, y: ny });
            }
          });
        }
        return seen;
      };
      const start = carvedRooms[0];
      for (let pass = 0; pass < carvedRooms.length; pass += 1) {
        const seen = floodFrom(start);
        const unreached = carvedRooms.filter(room => !seen.has(cIdx(room.x, room.y)));
        if (!unreached.length) {
          break;
        }
        const target = unreached[0];
        let nearest = start;
        let bestDistance = Infinity;
        carvedRooms.forEach((room) => {
          if (!seen.has(cIdx(room.x, room.y))) {
            return;
          }
          const distance = Math.abs(room.x - target.x) + Math.abs(room.y - target.y);
          if (distance < bestDistance) {
            bestDistance = distance;
            nearest = room;
          }
        });
        carveClearLine(nearest, target);
      }
    }

    const depthLevelBonus = (depth - 1) * 2;
    const depthRewardMultiplier = 1 + ((depth - 1) * 0.35);
    const themeMonsters = THEME_MONSTERS[themeName] || THEME_MONSTERS.stone;

    // A mid room (never the entry or the exit) holds the floor's treasure
    const treasureRoomIndex = carvedRooms.length >= 4
      ? 1 + Math.floor(rng() * (carvedRooms.length - 2))
      : -1;

    const roleCycle = ['melee', 'ranged', 'support'];
    const buildMonsterDefinition = ({
      center, index, role, rarity, name, levelBonus = 0, rewardMultiplier = 1,
      healthMultiplier = 0.13, damageMultiplier = 0.35, graphicRole = role,
    }) => {
      const behaviour = {
        type: role,
        aggressionRange: role === 'support' ? 6 : 8,
        pursuitRange: role === 'melee' ? 9 : 11,
        patrolRadius: 4,
        attack: {
          intervalMs: role === 'melee' ? 1500 : 1900,
          windupMs: role === 'melee' ? 320 : 480,
          damageMultiplier: role === 'support' ? 0.85 : 1.1,
          range: role === 'melee' ? 1 : 5,
          minimumRange: role === 'support' ? 2 : 1,
        },
      };

      if (role === 'support') {
        // Modest paced heal (support.js also enforces an interval and a
        // 30%-of-ally cap). The old 20 + index*5 escalated past entire trash
        // health pools — packs near a healer were unkillable.
        behaviour.support = {
          healAmount: 8 + depth,
          healRange: 6,
          healIntervalMs: 4000,
        };
      }

      const archetype = role === 'melee' ? 'brute' : 'mystic';

      return {
        id: `instance-${seed}-${index}`,
        name,
        tags: [...(THEME_MONSTER_TAGS[themeName]?.[graphicRole] || [])],
        // Floor-1 trash tracks a fresh character (level 1-3); depth and role
        // bonuses layer on top. Bosses take an explicit levelBonus. Scaling is
        // gentle so a floor is uniformly mow-through rather than spiking late.
        level: Math.max(1, Math.floor(1 + (index * 0.14))) + depthLevelBonus + levelBonus,
        archetype,
        rarity,
        graphic: instanceMonsterGraphic(themeName, graphicRole),
        // Squishy trash so packs can be mown through; bosses pass 1.0.
        healthMultiplier,
        damageMultiplier,
        spawn: {
          x: center.x,
          y: center.y,
          radius: 2,
        },
        behaviour,
        rewards: {
          experience: Math.round((30 + (index * 18)) * depthRewardMultiplier * rewardMultiplier),
          coins: Math.round((60 + (index * 20)) * depthRewardMultiplier * rewardMultiplier),
        },
        respawn: {
          delayMs: 600000,
        },
      };
    };

    const rollRarity = () => {
      const roll = rng();
      if (roll < 0.12) {
        return 'rare';
      }
      if (roll < 0.4) {
        return 'uncommon';
      }
      return 'common';
    };

    const instanceMonsters = [];
    let monsterIndex = 0;
    const exitRoomIndex = carvedRooms.length - 1;

    // A monster may only spawn on an open tile (not a wall, tree, or water),
    // so spread packs across a clearing safely: spiral out from the desired
    // spot to the nearest open tile, falling back to the (always-clear) centre.
    const monIdx = (x, y) => (y * width) + x;
    const isSpawnable = (x, y) => {
      if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) {
        return false;
      }
      const bgOk = UI.tileWalkable(background[monIdx(x, y)] - 1);
      const fgGid = foreground[monIdx(x, y)];
      return bgOk && (!fgGid || UI.tileWalkable(fgGid - 1, 'foreground'));
    };
    const findSpawn = (cx, cy, wantX, wantY) => {
      if (isSpawnable(wantX, wantY)) {
        return { x: wantX, y: wantY };
      }
      for (let radius = 1; radius <= 5; radius += 1) {
        for (let dy = -radius; dy <= radius; dy += 1) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            if (isSpawnable(wantX + dx, wantY + dy)) {
              return { x: wantX + dx, y: wantY + dy };
            }
          }
        }
      }
      return { x: cx, y: cy };
    };

    carvedRooms.forEach((center, roomIndex) => {
      if (roomIndex === 0) {
        return;
      }

      if (roomIndex === exitRoomIndex && carvedRooms.length > 1) {
        // The stairs down are guarded by the floor boss — a real damage sponge
        // that hits hard, unlike the trash (full health, near-full damage).
        instanceMonsters.push(buildMonsterDefinition({
          center,
          index: monsterIndex,
          role: 'melee',
          rarity: 'elite',
          name: themeMonsters.boss,
          graphicRole: 'boss',
          levelBonus: 3,
          rewardMultiplier: 3,
          healthMultiplier: 0.5,
          // ~33% of a level-1 player's HP per swing (was ~40%): hits like a
          // boss without three-tapping fresh characters.
          damageMultiplier: 0.5,
        }));
        monsterIndex += 1;
        return;
      }

      // Pack size comes from the recipe: tight rooms hold a small pack; open
      // clearings are big and want more, spread out so they do not read empty.
      const roomRect = roomRects[roomIndex];
      let packSize = recipe.packBase + Math.floor(rng() * recipe.packRoll);
      if (depth > 2) {
        packSize += 1;
      }
      if (rng() < 0.3) {
        packSize += 1;
      }

      // Spread radius: tight cluster by default, scattered across the room up to
      // recipe.spreadFrac of its extent for open layouts.
      const spread = recipe.spreadFrac && roomRect
        ? Math.max(3, Math.floor(Math.min(roomRect.width, roomRect.height) * recipe.spreadFrac))
        : 2;

      for (let member = 0; member < packSize; member += 1) {
        const role = roleCycle[monsterIndex % roleCycle.length];
        const isTreasureGuard = roomIndex === treasureRoomIndex && member === 0;
        // Distribute members around the centre, then snap to an open tile.
        const angle = (member / packSize) * Math.PI * 2 + (rng() * 0.8);
        const ring = member === 0 ? 0 : (0.4 + (rng() * 0.6)) * spread;
        const wantX = Math.round(center.x + Math.cos(angle) * ring);
        const wantY = Math.round(center.y + Math.sin(angle) * ring);
        const spot = findSpawn(center.x, center.y, wantX, wantY);
        instanceMonsters.push(buildMonsterDefinition({
          center: spot,
          index: monsterIndex,
          role: isTreasureGuard ? 'melee' : role,
          rarity: isTreasureGuard ? 'rare' : rollRarity(),
          name: themeMonsters[isTreasureGuard ? 'melee' : role],
          rewardMultiplier: isTreasureGuard ? 1.5 : 1,
          // Trash is squishy so a pack can be mown through before it focus-
          // fires the player down; treasure guards are a step tankier.
          healthMultiplier: isTreasureGuard ? 0.3 : 0.13,
          damageMultiplier: isTreasureGuard ? 0.45 : 0.35,
        }));
        monsterIndex += 1;
      }
    });

    // Players spawn on the walkable tiles around the entry stairs,
    // never on the stairs themselves (stepping on them transitions).
    const entry = carvedRooms[0];
    const exit = carvedRooms.length > 1 ? carvedRooms[carvedRooms.length - 1] : null;
    const idx = (x, y) => (y * width) + x;
    const tileIsOpen = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) {
        return false;
      }
      const bgWalkable = UI.tileWalkable(background[idx(x, y)] - 1);
      const fgGid = foreground[idx(x, y)];
      return bgWalkable && (!fgGid || UI.tileWalkable(fgGid - 1, 'foreground'));
    };

    // Scatter the treasure hoard on open tiles around the room centre
    const treasureCentre = treasureRoomIndex >= 0 ? carvedRooms[treasureRoomIndex] : null;
    const instanceItems = [];
    if (treasureCentre) {
      const treasureSpots = [
        { x: treasureCentre.x + 1, y: treasureCentre.y + 1 },
        { x: treasureCentre.x - 1, y: treasureCentre.y + 1 },
        { x: treasureCentre.x + 1, y: treasureCentre.y - 1 },
        { x: treasureCentre.x - 1, y: treasureCentre.y - 1 },
        { x: treasureCentre.x, y: treasureCentre.y + 2 },
      ].filter(spot => tileIsOpen(spot.x, spot.y));

      if (treasureSpots.length) {
        const coinQuantity = Math.round((80 + Math.floor(rng() * 60)) * depthRewardMultiplier);
        const coins = ItemFactory.createById('coins', { quantity: coinQuantity });
        if (coins) {
          instanceItems.push(ItemFactory.toWorldInstance(coins, treasureSpots[0]));
        }

        const gearPool = gearPoolForDepth(depth);
        const gearId = gearPool[Math.floor(rng() * gearPool.length)];
        const gear = ItemFactory.createById(gearId, { rng });
        if (gear && treasureSpots.length > 1) {
          instanceItems.push(ItemFactory.toWorldInstance(gear, treasureSpots[1]));
        }
      }
    }

    const spawnPoints = [
      { x: entry.x + 1, y: entry.y },
      { x: entry.x - 1, y: entry.y },
      { x: entry.x, y: entry.y + 1 },
      { x: entry.x, y: entry.y - 1 },
    ].filter(tile => tileIsOpen(tile.x, tile.y));

    if (!spawnPoints.length) {
      spawnPoints.push({ ...entry });
    }

    return {
      map: {
        background,
        foreground,
      },
      metadata: {
        seed,
        baseSeed,
        depth,
        template,
        theme: themeName,
        layout: layoutId,
        spawnPoints,
        roomCentres: carvedRooms,
        stairsUp: { x: entry.x, y: entry.y },
        stairsDown: exit ? { x: exit.x, y: exit.y } : null,
        treasureRoom: treasureCentre ? { x: treasureCentre.x, y: treasureCentre.y } : null,
        rewards: {
          coinsPerPlayer: Math.round((120 + (instanceMonsters.length * 20)) * depthRewardMultiplier),
          experience: {
            skill: 'attack',
            amount: Math.round((40 + (instanceMonsters.length * 10)) * depthRewardMultiplier),
          },
        },
      },
      respawns: {
        items: [],
        monsters: [],
        resources: [],
      },
      items: instanceItems,
      npcs: [],
      monsters: instanceMonsters,
    };
  }

  /**
   * Load map tile data
   *
   * @returns {array}
   */
  static async load() {
    const data = await Map.fetchMap('surface');

    return data;
  }

  /**
   * Resolve a promise to find the path
   *
   * @param {integer} x The x-axis coord on where user clicked on game-gap
   * @param {integer} y The y-axis coord on where user clicked on game-gap
   */
  static findQuickestPath(x, y, playerIndex, { stopAdjacent = false } = {}) {
    const player = world.players[playerIndex];
    return new Promise((resolve) => {
      if (!player || !player.path || !player.path.grid) {
        resolve([]);
        return;
      }

      const defaultCenter = {
        x: Math.floor(config.map.viewport.x / 2),
        y: Math.floor(config.map.viewport.y / 2),
      };
      const center = player.path.center || defaultCenter;
      const sourceGrid = player.path.grid;

      /**
       * Get location of all 4 spots, check tile if blocked
       * Get direction based off player and where to check first
       */

      const candidates = stopAdjacent
        ? [
          { x: x - 1, y },
          { x: x + 1, y },
          { x, y: y - 1 },
          { x, y: y + 1 },
          { x: x - 1, y: y - 1 },
          { x: x + 1, y: y - 1 },
          { x: x - 1, y: y + 1 },
          { x: x + 1, y: y + 1 },
        ]
        : [{ x, y }];

      const paths = candidates
        .filter((candidate) => {
          if (candidate.x < 0 || candidate.y < 0
            || candidate.x >= sourceGrid.width || candidate.y >= sourceGrid.height) {
            return false;
          }
          if (typeof sourceGrid.isWalkableAt !== 'function') {
            return true;
          }
          return sourceGrid.isWalkableAt(candidate.x, candidate.y);
        })
        .map((candidate) => {
          const grid = typeof sourceGrid.clone === 'function'
            ? sourceGrid.clone()
            : sourceGrid;
          return player.path.finder.findPath(
            center.x,
            center.y,
            candidate.x,
            candidate.y,
            grid,
          );
        })
        .filter(path => path.length > 0)
        .sort((left, right) => left.length - right.length);

      resolve(paths[0] || []);
    });
  }

  /**
   * Find a path and set that path in motion
   *
   * @param {string} uuidPath The unique user-id indentifying who is moving
   * @param {integer} x The x-axis coord on where user clicked on game-gap
   * @param {integer} y The y-axis coord on where user clicked on game-gap
   */
  static async findPath(uuidPath, x, y, location) {
    const playerIndex = world.players.findIndex(p => p.uuid === uuidPath);
    if (playerIndex === -1) return;

    const pathingPlayer = world.players[playerIndex];
    if (pathingPlayer.stats
      && pathingPlayer.stats.resources
      && pathingPlayer.stats.resources.health
      && pathingPlayer.stats.resources.health.current <= 0) {
      // The dead don't walk
      return;
    }

    if (world.players[playerIndex].moving) {
      world.players[playerIndex].path.current.interrupted = true;
    }

    // The player's x-y on map (always 7,5)
    // to where they clicked on the map
    const path = await Map.findQuickestPath(x, y, playerIndex, {
      stopAdjacent: location === 'edge',
    });

    // Since we are performing an action on a resource or tile,
    // let's end the path one step so we don't step on it.
    // (For example, mining block, tree, door, etc.)
    // If the tile we clicked on
    // can be walked on, continue ->
    if (world.players[playerIndex].path.current.walkable && path.length && path.length >= 1) {
      world.players[playerIndex].path.current.path.walking = path;
      world.players[playerIndex].path.current.step = 0;
      world.players[playerIndex].path.current.interrupted = false;

      // We start moving the player along their path
      world.players[playerIndex].walkPath(playerIndex);
    }
  }

  /**
   * Set up the map
   */
  setUp() {
    const layout = createWorldLayout();
    const town = layout.town;
    const townScene = world.getDefaultTown();

    this.background = town.map.background;
    this.foreground = town.map.foreground;

    townScene.name = town.name;
    townScene.type = town.type;
    townScene.persistent = town.persistent;
    townScene.metadata = town.metadata;

    layout.scenes.forEach((scene) => {
      world.ensureScene(scene.id, scene);
    });

    // Set items on map
    const itemsOnMap = [
      ...armor,
      ...jewelry,
      ...weapons,
    ];

    // Spawn items on the map
    world.items = Map.readyItems(itemsOnMap);

    // Set the respawns accordingly
    world.respawns = {
      items: itemsOnMap.map((item) => ({
        ...item,
        pickedUp: false,
      })),
      monsters: [],
      resources: [],
    };

    // Load shops
    world.shops = Shop.load();

    // Add a timestamp to all dropped items
    world.items = world.items.map((i) => {
      i.timestamp = Date.now();
      return i;
    });
  }

  /**
   * Add a UUID and mark items as respawns to all respawned items
   *
   * @param {array} items List of respawned items
   * @returns {array}
   */
  static readyItems(items) {
    return items.map((definition) => {
      const location = { x: definition.x, y: definition.y };
      const baseItem = ItemFactory.createById(definition.id);

      if (!baseItem) {
        return ItemFactory.toWorldInstance({ id: definition.id }, location, {
          respawn: true,
        });
      }

      const worldItem = ItemFactory.toWorldInstance(baseItem, location, {
        respawn: true,
      });

      worldItem.respawnIn = definition.respawnIn;
      return worldItem;
    });
  }

  /**
   * Loads the map from an external JSON file
   *
   * @param {string} level The level of the map
   * @returns {array}
   */
  static fetchMap(level) {
    const mapToLoad = {
      surface: surfaceMap,
    };

    return new Promise((resolve, reject) => {
      if (!mapToLoad[level]) {
        reject(new Error(`Unknown map level: ${level}`));
        return;
      }

      resolve(mapToLoad[level].layers);
    });
  }

  /**
   * Get the blocked/non-blocked tile-matrix of their viewport
   *
   * @param {object} player The player asking
   */
  static getMatrix(player, options = {}) {
    const { x, y } = player;
    const { size } = config.map;
    const defaultViewport = player.path && player.path.viewport
      ? player.path.viewport
      : config.map.viewport;

    return new Promise((resolve) => {
      const requestedViewport = options.viewport || defaultViewport;
      const viewport = {
        x: Math.max(
          0,
          Math.min(
            typeof requestedViewport.x === 'number' ? requestedViewport.x : defaultViewport.x,
            size.x - 1,
          ),
        ),
        y: Math.max(
          0,
          Math.min(
            typeof requestedViewport.y === 'number' ? requestedViewport.y : defaultViewport.y,
            size.y - 1,
          ),
        ),
      };

      const requestedCenter = options.center || null;
      const center = {
        x: requestedCenter && typeof requestedCenter.x === 'number'
          ? requestedCenter.x
          : Math.floor(viewport.x / 2),
        y: requestedCenter && typeof requestedCenter.y === 'number'
          ? requestedCenter.y
          : Math.floor(viewport.y / 2),
      };

      const tileCrop = {
        x: x - center.x,
        y: y - center.y,
      };

      const matrix = [];

      // Drawing the map row by column.
      for (let column = 0; column <= viewport.y; column += 1) {
        const grid = [];
        for (let row = 0; row <= viewport.x; row += 1) {
          const worldColumn = column + tileCrop.y;
          const worldRow = row + tileCrop.x;

          if (
            worldColumn < 0
            || worldRow < 0
            || worldColumn >= size.y
            || worldRow >= size.x
          ) {
            grid.push(1);
          } else {
            const onTile = (worldColumn * size.x) + worldRow;
            const scene = world.getSceneForPlayer(player);
            const activeMap = scene && scene.map ? scene.map : world.map;
            const tiles = {
              background: activeMap.background[onTile] - 1,
              foreground: activeMap.foreground[onTile] - 1,
            };

            // Push the block/non-blocked tile to the
            // grid so that the pathfinder can use it
            // 0 - walkable; 1 - blocked
            grid.push(MapUtils.gridWalkable(
              tiles,
              player,
              onTile,
              row,
              column,
              activeMap,
            ));
          }
        }

        // Push blocked/non-blocked array for pathfinding
        matrix.push(grid);
      }

      // The new walkable/non-walkable grid
      resolve({
        grid: new PF.Grid(matrix),
        viewport,
        center,
      });
    });
  }
}

export default Map;
