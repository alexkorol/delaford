import { armor, jewelry, weapons } from '#server/core/data/respawn/index.js';
import { v4 as uuid } from 'uuid';

import MapUtils from '#shared/map-utils.js';
import PF from 'pathfinding';
import UI from '#shared/ui.js';
import config from '#server/config.js';
import surfaceMap from '#server/maps/layers/surface.json' with { type: 'json' };
import DUNGEON_TILESET, { dungeonGid, dungeonGroupGids } from '#shared/dungeon-tiles.js';
import { instanceMonsterGraphic } from '#shared/actor-graphics.js';
import ItemFactory from './items/factory.js';
import { Shop } from './functions/index.js';
import world from './world.js';
import createWorldLayout from './world-layout.js';

const DEFAULT_INSTANCE_ROOM_COUNT = 12;
const DEFAULT_OUTDOOR_CLEARING_COUNT = 9;
const DEFAULT_CORRIDOR_WIDTH = 3;
export const INSTANCE_SPAWN_SAFE_RADIUS = 6;

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

// The existing monster atlas contains eighteen readable silhouettes. Generated
// floors used to omit graphic metadata, making every role render as column 0.
// Give melee, ranged, support, and elite enemies a stable visual language while
// rotating the exact bodies between themes.
const THEME_MONSTER_COLUMNS = {
  stone: [4, 9, 16],
  crypt: [1, 11, 13],
  sand: [3, 8, 17],
  volcanic: [6, 14, 16],
  marsh: [0, 8, 13],
  grove: [1, 6, 9],
  wilds: [3, 11, 17],
};

const THEME_ROLE_CYCLES = {
  stone: ['melee', 'ranged', 'support'],
  crypt: ['melee', 'melee', 'support', 'buffer'],
  sand: ['ranged', 'ranged', 'buffer', 'melee'],
  volcanic: ['melee', 'buffer', 'melee', 'ranged'],
  marsh: ['support', 'ranged', 'buffer', 'melee'],
  grove: ['melee', 'ranged', 'buffer', 'support'],
  wilds: ['melee', 'melee', 'ranged', 'buffer'],
};

const RARE_MODIFIERS = [
  { id: 'thick-hide', label: 'Thick Hide', healthMultiplier: 1.2 },
  { id: 'frenzied', label: 'Frenzied', attackIntervalMultiplier: 0.88 },
];

// Treasure-room gear pools draw from the native Vessel catalogue so hoard
// gear carries an honest rolled identity whose item level scales with depth;
// deeper floors weight toward the martial and jewelry forms.
const INSTANCE_LOOT_TIERS = [
  { minDepth: 1, gear: ['vessel-handaxe', 'vessel-spear', 'vessel-wrap', 'vessel-shield', 'vessel-sandals', 'vessel-crest'] },
  { minDepth: 3, gear: ['vessel-macuahuitl', 'vessel-sling', 'vessel-grips', 'vessel-gorget', 'vessel-khopesh', 'vessel-shield'] },
  { minDepth: 5, gear: ['vessel-khopesh', 'vessel-atlatl', 'vessel-ring', 'vessel-crest', 'vessel-macuahuitl', 'vessel-spear'] },
];

const gearPoolForDepth = (depth) => {
  const eligible = INSTANCE_LOOT_TIERS.filter(tier => depth >= tier.minDepth);
  return eligible.length ? eligible[eligible.length - 1].gear : INSTANCE_LOOT_TIERS[0].gear;
};

export const instanceItemLevelForDepth = depth => Math.min(
  80,
  10 + ((Math.max(1, Math.floor(Number(depth) || 1)) - 1) * 10),
);

// Fast walkability probe for generated instances. Every tile generateInstance
// writes comes from the dungeon tileset, whose walkability UI.tileWalkable
// resolves through two Set lookups; hoisting those sets removes per-call
// overhead from the connectivity flood fill and the spawn probes (tens of
// thousands of calls per floor). Any gid outside the dungeon range falls back
// to UI.tileWalkable, so the result is identical for every possible input.
const DUNGEON_ZERO = DUNGEON_TILESET.firstGid - 1;
const DUNGEON_BLOCKED_BG = new Set(DUNGEON_TILESET.blockedBg);
const DUNGEON_WALKABLE_FG = new Set(DUNGEON_TILESET.walkableFg);

const generatedTileWalkable = (background, foreground, index) => {
  const bgZero = background[index] - 1;
  const bgOpen = bgZero >= DUNGEON_ZERO
    ? !DUNGEON_BLOCKED_BG.has(bgZero - DUNGEON_ZERO)
    : UI.tileWalkable(bgZero);
  if (!bgOpen) {
    return false;
  }
  const fgGid = foreground[index];
  if (!fgGid) {
    return true;
  }
  const fgZero = fgGid - 1;
  return fgZero >= DUNGEON_ZERO
    ? DUNGEON_WALKABLE_FG.has(fgZero - DUNGEON_ZERO)
    : UI.tileWalkable(fgZero, 'foreground');
};

// Per-row horizontal spans of every carved (background-written) cell, plus an
// overall bounding box. decorateInstance's wall pass only needs to inspect
// wall cells within one tile of carved floor, so it scans just this dilated
// region instead of the full 200x200 grid. INVARIANT: the spans are an exact
// superset of the cells the carve step wrote, so every qualifying wall cell
// is still visited in the same row-major order a full sweep would visit it,
// and the pass (including its rng consumption and output) is unchanged.
const createCarveBounds = (mapWidth, mapHeight) => ({
  minX: Infinity,
  minY: Infinity,
  maxX: -Infinity,
  maxY: -Infinity,
  mapWidth,
  rowMin: new Int32Array(mapHeight).fill(mapWidth),
  rowMax: new Int32Array(mapHeight).fill(-1),
});

const recordCarveSpan = (bounds, minX, minY, maxX, maxY) => {
  if (minX < bounds.minX) bounds.minX = minX;
  if (minY < bounds.minY) bounds.minY = minY;
  if (maxX > bounds.maxX) bounds.maxX = maxX;
  if (maxY > bounds.maxY) bounds.maxY = maxY;
  const clampedMinX = Math.max(0, minX);
  const clampedMaxX = Math.min(bounds.mapWidth - 1, maxX);
  const firstRow = Math.max(0, minY);
  const lastRow = Math.min(bounds.rowMax.length - 1, maxY);
  for (let row = firstRow; row <= lastRow; row += 1) {
    if (clampedMinX < bounds.rowMin[row]) bounds.rowMin[row] = clampedMinX;
    if (clampedMaxX > bounds.rowMax[row]) bounds.rowMax[row] = clampedMaxX;
  }
};

// Party floors are deterministic per seed/depth and are commonly revisited.
// Retain a small number of completed generation templates so a revisit only
// pays for isolated output copies, not the procedural build. Sixteen entries
// cover the benchmark matrix and typical active-party depth working sets while
// keeping the bounded map-layer memory cost modest (~10 MB at 200x200).
const INSTANCE_TEMPLATE_CACHE_LIMIT = 16;
const INSTANCE_TEMPLATE_ADMISSION_LIMIT = 64;
const instanceTemplateCache = new globalThis.Map();
const instanceTemplateAdmissions = new globalThis.Map();

const clonePoint = point => (point ? { x: point.x, y: point.y } : null);

const cloneMonsterBehaviour = (behaviour) => {
  if (!behaviour) return behaviour;
  const clone = {
    ...behaviour,
    attack: behaviour.attack ? { ...behaviour.attack } : behaviour.attack,
  };
  if (behaviour.support) clone.support = { ...behaviour.support };
  if (behaviour.aura) clone.aura = { ...behaviour.aura };
  return clone;
};

const cloneMonsterDefinition = monster => ({
  ...monster,
  graphic: monster.graphic ? { ...monster.graphic } : monster.graphic,
  modifiers: Array.isArray(monster.modifiers)
    ? monster.modifiers.map(modifier => ({ ...modifier }))
    : [],
  spawn: monster.spawn ? { ...monster.spawn } : monster.spawn,
  behaviour: cloneMonsterBehaviour(monster.behaviour),
  rewards: monster.rewards ? { ...monster.rewards } : monster.rewards,
  respawn: monster.respawn ? { ...monster.respawn } : monster.respawn,
});

const cloneGeneratedItem = (item, refreshVolatileFields) => {
  // Generated item definitions are JSON data. JSON cloning is both faster than
  // structuredClone for these small records and exactly matches the catalogue
  // clone semantics used by Query.getItemData.
  const clone = JSON.parse(JSON.stringify(item));
  if (refreshVolatileFields) {
    clone.uuid = uuid();
    clone.timestamp = Date.now();
  }
  return clone;
};

const cloneGeneration = (generation, refreshItemIdentity = true) => ({
  map: {
    background: generation.map.background.slice(),
    foreground: generation.map.foreground.slice(),
  },
  metadata: {
    ...generation.metadata,
    spawnPoints: generation.metadata.spawnPoints.map(clonePoint),
    roomCentres: generation.metadata.roomCentres.map(clonePoint),
    stairsUp: clonePoint(generation.metadata.stairsUp),
    stairsDown: clonePoint(generation.metadata.stairsDown),
    treasureRoom: clonePoint(generation.metadata.treasureRoom),
    rewards: {
      ...generation.metadata.rewards,
      experience: { ...generation.metadata.rewards.experience },
    },
  },
  respawns: {
    items: generation.respawns.items.map(item => ({ ...item })),
    monsters: generation.respawns.monsters.map(monster => ({ ...monster })),
    resources: generation.respawns.resources.map(resource => ({ ...resource })),
  },
  items: generation.items.map(item => cloneGeneratedItem(item, refreshItemIdentity)),
  npcs: generation.npcs.map(npc => ({ ...npc })),
  monsters: generation.monsters.map(cloneMonsterDefinition),
});

const readCachedGeneration = (key) => {
  const cached = instanceTemplateCache.get(key);
  if (!cached) return null;
  // Refresh insertion order for true LRU eviction.
  instanceTemplateCache.delete(key);
  instanceTemplateCache.set(key, cached);
  return cloneGeneration(cached);
};

const cacheGeneration = (key, generation) => {
  // A fresh Date.now seed is the common zone case and is normally never seen
  // again. Admit only on the second observation so one-off generations keep
  // the full cold-path speedup and cannot churn the useful revisit cache.
  if (!instanceTemplateAdmissions.has(key)) {
    instanceTemplateAdmissions.set(key, true);
    if (instanceTemplateAdmissions.size > INSTANCE_TEMPLATE_ADMISSION_LIMIT) {
      instanceTemplateAdmissions.delete(instanceTemplateAdmissions.keys().next().value);
    }
    return;
  }
  instanceTemplateAdmissions.delete(key);
  instanceTemplateCache.set(key, cloneGeneration(generation, false));
  if (instanceTemplateCache.size > INSTANCE_TEMPLATE_CACHE_LIMIT) {
    instanceTemplateCache.delete(instanceTemplateCache.keys().next().value);
  }
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

  static carveRoom(background, foreground, width, height, x, y, tileId, rng, bounds) {
    const mapWidth = surfaceMap.width;
    // Resolve the per-cell tile source once: Map.pickTile branched on it for
    // every carved tile. The rng call sequence (and so the carved tiles) is
    // unchanged.
    let pick;
    if (typeof tileId === 'function') {
      pick = tileId;
    } else if (Array.isArray(tileId)) {
      pick = () => tileId[Math.floor((rng ? rng() : Math.random()) * tileId.length)] || tileId[0];
    } else {
      pick = () => tileId;
    }
    for (let row = y; row < y + height; row += 1) {
      let index = (row * mapWidth) + x;
      for (let col = x; col < x + width; col += 1) {
        background[index] = pick();
        foreground[index] = 0;
        index += 1;
      }
    }
    if (bounds) {
      recordCarveSpan(bounds, x, y, x + width - 1, y + height - 1);
    }
  }

  static carveCorridor(background, foreground, from, to, corridorWidth, tileId, rng, bounds) {
    const mapWidth = surfaceMap.width;
    const mapHeight = surfaceMap.height;
    const minX = Math.min(from.x, to.x);
    const maxX = Math.max(from.x, to.x);
    const minY = Math.min(from.y, to.y);
    const maxY = Math.max(from.y, to.y);
    const halfWidth = Math.floor(corridorWidth / 2);
    // Same per-cell source hoist as carveRoom; cell visit order and rng
    // consumption are unchanged.
    let pick;
    if (typeof tileId === 'function') {
      pick = tileId;
    } else if (Array.isArray(tileId)) {
      pick = () => tileId[Math.floor((rng ? rng() : Math.random()) * tileId.length)] || tileId[0];
    } else {
      pick = () => tileId;
    }

    const carveColumn = (xCoord) => {
      for (let row = minY; row <= maxY; row += 1) {
        for (let offset = -halfWidth; offset <= halfWidth; offset += 1) {
          const col = xCoord + offset;
          if (col < 0 || col >= mapWidth || row < 0 || row >= mapHeight) {
            continue;
          }

          const index = (row * mapWidth) + col;
          background[index] = pick();
          foreground[index] = 0;
        }
      }
    };

    const carveRow = (yCoord) => {
      for (let col = minX; col <= maxX; col += 1) {
        for (let offset = -halfWidth; offset <= halfWidth; offset += 1) {
          const row = yCoord + offset;
          if (col < 0 || col >= mapWidth || row < 0 || row >= mapHeight) {
            continue;
          }

          const index = (row * mapWidth) + col;
          background[index] = pick();
          foreground[index] = 0;
        }
      }
    };

    carveRow(from.y);
    carveColumn(to.x);

    if (bounds) {
      recordCarveSpan(bounds, minX, from.y - halfWidth, maxX, from.y + halfWidth);
      recordCarveSpan(bounds, to.x - halfWidth, minY, to.x + halfWidth, maxY);
    }
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
    carveBounds = null,
  }) {
    const idx = (x, y) => (y * width) + x;
    // Set membership instead of wallPool.includes(): the wall pass probes
    // this for every candidate cell and a linear scan per probe dominated
    // generation time. Same membership, same result.
    const wallSet = new Set(wallPool);
    const isFloorTile = tile => tile !== wallFill && !wallSet.has(tile);
    const isFloor = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) {
        return false;
      }
      return isFloorTile(background[idx(x, y)]);
    };

    // Wall pass: any solid cell touching open space gets a varied wall face.
    // Only wall cells within one tile of carved floor can qualify, and the
    // carve step records the exact per-row span of every background write, so
    // this scans just that dilated region in the same row-major order a full
    // grid sweep would visit qualifying cells: identical visits, identical
    // rng consumption, a fraction of the work. Callers that pass no carve
    // bounds fall back to the full sweep.
    const spanRowMin = carveBounds ? carveBounds.rowMin : null;
    const spanRowMax = carveBounds ? carveBounds.rowMax : null;
    for (let y = 0; y < height; y += 1) {
      let spanMin = 0;
      let spanMax = width - 1;
      if (spanRowMin && spanRowMax) {
        spanMin = Infinity;
        spanMax = -1;
        const firstRow = Math.max(0, y - 1);
        const lastRow = Math.min(height - 1, y + 1);
        for (let row = firstRow; row <= lastRow; row += 1) {
          if (spanRowMin[row] < spanMin) spanMin = spanRowMin[row];
          if (spanRowMax[row] > spanMax) spanMax = spanRowMax[row];
        }
        if (spanMax < 0) {
          continue;
        }
        spanMin = Math.max(0, spanMin - 1);
        spanMax = Math.min(width - 1, spanMax + 1);
      }
      const rowBase = y * width;
      const rowAbove = y > 0 ? rowBase - width : -1;
      const rowBelow = y < height - 1 ? rowBase + width : -1;
      for (let x = spanMin; x <= spanMax; x += 1) {
        const index = rowBase + x;
        if (background[index] !== wallFill) {
          continue;
        }
        const hasLeft = x > 0;
        const hasRight = x < width - 1;
        let touchesFloor = false;
        if (rowAbove >= 0) {
          touchesFloor = (hasLeft && isFloorTile(background[rowAbove + x - 1]))
            || isFloorTile(background[rowAbove + x])
            || (hasRight && isFloorTile(background[rowAbove + x + 1]));
        }
        if (!touchesFloor) {
          touchesFloor = (hasLeft && isFloorTile(background[rowBase + x - 1]))
            || (hasRight && isFloorTile(background[rowBase + x + 1]));
        }
        if (!touchesFloor && rowBelow >= 0) {
          touchesFloor = (hasLeft && isFloorTile(background[rowBelow + x - 1]))
            || isFloorTile(background[rowBelow + x])
            || (hasRight && isFloorTile(background[rowBelow + x + 1]));
        }
        if (touchesFloor && wallPool.length > 1) {
          background[index] = wallPool[Math.floor(rng() * wallPool.length)];
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

    const cacheKey = JSON.stringify([
      seed,
      baseSeed,
      template,
      baseThemeName,
      themeName,
      layoutId,
      options.rooms || null,
      options.corridorWidth || null,
    ]);
    const cachedGeneration = readCachedGeneration(cacheKey);
    if (cachedGeneration) {
      return cachedGeneration;
    }

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
    // Tracks exactly where carving writes, so decorateInstance's wall pass
    // only scans the carved region instead of the full 200x200 grid (see
    // createCarveBounds).
    const carveBounds = createCarveBounds(width, height);

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

      Map.carveRoom(background, foreground, roomWidth, roomHeight, originX, originY, floorPicker, rng, carveBounds);

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
          carveBounds,
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
          carveBounds,
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
      carveBounds,
    });

    // Guarantee connectivity: decor, water, or clamped overlaps can block a
    // path after carving, so flood-fill from the entry and carve a clean
    // corridor to any unreachable room centre. Without this a pack, the
    // treasure, or the stairs down can end up sealed off.
    if (carvedRooms.length > 1) {
      const cIdx = (x, y) => (y * width) + x;
      const clearTile = (x, y) => {
        if (x < 0 || y < 0 || x >= width || y >= height) {
          return;
        }
        const index = cIdx(x, y);
        background[index] = floorPicker();
        const fgGid = foreground[index];
        if (fgGid && !UI.tileWalkable(fgGid - 1, 'foreground')) {
          foreground[index] = 0;
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
      // Typed-array flood fill: the reachable set is identical to the
      // previous Set + {x, y} queue version, without allocating two objects
      // per visited cell. Neighbour bounds are checked arithmetically, which
      // matches the old inBounds gate exactly, and the walkable test is the
      // same UI.tileWalkable result via generatedTileWalkable.
      const seen = new Uint8Array(width * height);
      const queue = new Int32Array(width * height);
      const floodFrom = (start) => {
        seen.fill(0);
        let head = 0;
        let tail = 0;
        const startIndex = cIdx(start.x, start.y);
        seen[startIndex] = 1;
        queue[tail] = startIndex;
        tail += 1;
        const visit = (ni) => {
          if (!seen[ni] && generatedTileWalkable(background, foreground, ni)) {
            seen[ni] = 1;
            queue[tail] = ni;
            tail += 1;
          }
        };
        while (head < tail) {
          const current = queue[head];
          head += 1;
          const currentX = current % width;
          const currentY = Math.floor(current / width);
          if (currentX + 1 < width) {
            visit(current + 1);
          }
          if (currentX > 0) {
            visit(current - 1);
          }
          if (currentY + 1 < height) {
            visit(current + width);
          }
          if (currentY > 0) {
            visit(current - width);
          }
        }
        return seen;
      };
      const start = carvedRooms[0];
      for (let pass = 0; pass < carvedRooms.length; pass += 1) {
        const reached = floodFrom(start);
        const unreached = carvedRooms.filter(room => !reached[cIdx(room.x, room.y)]);
        if (!unreached.length) {
          break;
        }
        const target = unreached[0];
        let nearest = start;
        let bestDistance = Infinity;
        carvedRooms.forEach((room) => {
          if (!reached[cIdx(room.x, room.y)]) {
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
    const themeMonsterColumns = THEME_MONSTER_COLUMNS[themeName] || THEME_MONSTER_COLUMNS.stone;

    // A mid room (never the entry or the exit) holds the floor's treasure
    const treasureRoomIndex = carvedRooms.length >= 4
      ? 1 + Math.floor(rng() * (carvedRooms.length - 2))
      : -1;

    const roleCycle = THEME_ROLE_CYCLES[themeName] || THEME_ROLE_CYCLES.stone;
    const buildMonsterDefinition = ({
      center, index, role, rarity, name, levelBonus = 0, rewardMultiplier = 1,
      healthMultiplier = 0.13, damageMultiplier = 0.35, graphicRole = role,
    }) => {
      const monsterLevel = Math.max(1, Math.floor(1 + (index * 0.14))) + depthLevelBonus + levelBonus;
      const behaviour = {
        type: role,
        aggressionRange: ['support', 'buffer'].includes(role) ? 6 : 8,
        pursuitRange: role === 'melee' ? 9 : 11,
        patrolRadius: 4,
        attack: {
          intervalMs: role === 'melee' ? 1500 : 1900,
          windupMs: role === 'melee' ? 320 : 480,
          damageMultiplier: ['support', 'buffer'].includes(role) ? 0.85 : 1.1,
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

      if (role === 'buffer') {
        behaviour.aura = {
          radius: 6,
          damageMultiplier: 1.12,
          intervalMs: 1500,
          durationMs: 2200,
        };
      }

      const archetype = role === 'melee' ? 'brute' : 'mystic';

      const rareModifier = rarity === 'rare'
        ? RARE_MODIFIERS[(seed + index) % RARE_MODIFIERS.length]
        : null;
      if (rareModifier?.attackIntervalMultiplier) {
        behaviour.attack.intervalMs = Math.round(
          behaviour.attack.intervalMs * rareModifier.attackIntervalMultiplier,
        );
      }
      const modifiedHealth = healthMultiplier * (rareModifier?.healthMultiplier || 1);
      const rareRewardMultiplier = rareModifier ? 1.35 : 1;

      return {
        id: `instance-${seed}-${index}`,
        name,
        tags: [...(THEME_MONSTER_TAGS[themeName]?.[graphicRole] || [])],
        // Floor-1 trash tracks a fresh character (level 1-3); depth and role
        // bonuses layer on top. Bosses take an explicit levelBonus. Scaling is
        // gentle so a floor is uniformly mow-through rather than spiking late.
        level: monsterLevel,
        archetype,
        rarity,
        graphic: instanceMonsterGraphic(themeName, graphicRole),
        // Squishy trash so packs can be mown through; bosses pass 1.0.
        healthMultiplier: modifiedHealth,
        damageMultiplier,
        modifiers: rareModifier ? [{ id: rareModifier.id, label: rareModifier.label }] : [],
        spawn: {
          x: center.x,
          y: center.y,
          radius: 2,
        },
        behaviour,
        rewards: {
          // Reward the threat, not the creature's spawn order. The old global
          // index term made a floor's XP grow quadratically: clearing an
          // ordinary 40-monster first floor jumped a scion to level 33-36.
          // Six ordinary opening kills must still cross the level-2 threshold
          // so the fight -> point -> tree loop starts promptly.
          experience: Math.round((12 + monsterLevel) * depthRewardMultiplier * rewardMultiplier * rareRewardMultiplier),
          coins: Math.round((60 + (index * 20)) * depthRewardMultiplier * rewardMultiplier * rareRewardMultiplier),
        },
        respawn: {
          delayMs: 600000,
        },
      };
    };

    const rollRarity = () => {
      const roll = rng();
      const rareThreshold = Math.min(0.3, 0.12 + ((depth - 1) * 0.02));
      if (roll < rareThreshold) {
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
    const entry = carvedRooms[0];

    // A monster may only spawn on an open tile (not a wall, tree, or water),
    // so spread packs across a clearing safely: spiral out from the desired
    // spot to the nearest open tile, falling back to the (always-clear) centre.
    const monIdx = (x, y) => (y * width) + x;
    const isSpawnable = (x, y) => {
      if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) {
        return false;
      }
      // Keep the landing room readable and fair even when procedural rooms
      // overlap. Skipping room zero alone was insufficient: packs belonging
      // to a neighbouring room could still be placed beside the stairs.
      if (Math.max(Math.abs(x - entry.x), Math.abs(y - entry.y)) <= INSTANCE_SPAWN_SAFE_RADIUS) {
        return false;
      }
      return generatedTileWalkable(background, foreground, monIdx(x, y));
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
      // A heavily overlapping layout may have no safe tile in the local
      // room. Fall back to the nearest room centre, then any safe floor tile,
      // instead of silently putting the monster back in the landing zone.
      const roomFallback = carvedRooms.find(room => isSpawnable(room.x, room.y));
      if (roomFallback) return { x: roomFallback.x, y: roomFallback.y };
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          if (isSpawnable(x, y)) return { x, y };
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
          center: findSpawn(center.x, center.y, center.x, center.y),
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
        const boss = instanceMonsters[instanceMonsters.length - 1];
        boss.behaviour.attack = {
          ...boss.behaviour.attack,
          skillId: 'boss:ground-slam',
          skillName: 'Ground Slam',
          radius: 2.5,
          windupMs: 1000,
        };
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
          name: themeMonsters[isTreasureGuard ? 'melee' : role] || themeMonsters.support,
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
    const exit = carvedRooms.length > 1 ? carvedRooms[carvedRooms.length - 1] : null;
    const idx = (x, y) => (y * width) + x;
    const tileIsOpen = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) {
        return false;
      }
      return generatedTileWalkable(background, foreground, idx(x, y));
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
        const gear = ItemFactory.createById(gearId, {
          rng,
          itemLevel: instanceItemLevelForDepth(depth),
        });
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

    const generation = {
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
            // Completion is a satisfying bump, not a second floor's worth of
            // XP. Most progression already came from the monsters themselves.
            amount: Math.round((40 + Math.floor(instanceMonsters.length / 3)) * depthRewardMultiplier),
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
    cacheGeneration(cacheKey, generation);
    return generation;
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
  static findQuickestPath(x, y, playerReference, { stopAdjacent = false } = {}) {
    const player = playerReference && typeof playerReference === 'object'
      ? playerReference
      : world.players[playerReference];
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
    const pathingPlayer = world.players.find(p => p.uuid === uuidPath);
    if (!pathingPlayer) return;
    const sessionSocketId = pathingPlayer.socket_id;
    if (pathingPlayer.stats
      && pathingPlayer.stats.resources
      && pathingPlayer.stats.resources.health
      && pathingPlayer.stats.resources.health.current <= 0) {
      // The dead don't walk
      return;
    }

    if (pathingPlayer.moving) {
      pathingPlayer.path.current.interrupted = true;
    }

    // The player's x-y on map (always 7,5)
    // to where they clicked on the map
    const path = await Map.findQuickestPath(x, y, pathingPlayer, {
      stopAdjacent: location === 'edge',
    });

    // Pathfinding is async. If this character reconnected while it was
    // running, the old session must not mutate or drive the replacement.
    const livePlayer = world.players.find(player => (
      player.uuid === uuidPath && player.socket_id === sessionSocketId
    ));
    if (livePlayer !== pathingPlayer) {
      return;
    }

    // Since we are performing an action on a resource or tile,
    // let's end the path one step so we don't step on it.
    // (For example, mining block, tree, door, etc.)
    // If the tile we clicked on
    // can be walked on, continue ->
    if (pathingPlayer.path.current.walkable && path.length && path.length >= 1) {
      pathingPlayer.path.current.path.walking = path;
      pathingPlayer.path.current.step = 0;
      pathingPlayer.path.current.interrupted = false;

      // We start moving the player along their path
      pathingPlayer.walkPath();
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

    // Floor samples make the traders legible at a glance. They use the
    // normal world-item renderer, but are marked as displays so interaction
    // opens the owning shop instead of taking the sample for free.
    const shopDisplays = world.shops.flatMap(shop => shop.displays.map((display) => {
      const item = ItemFactory.createById(display.item);
      if (!item) return null;
      const worldItem = ItemFactory.toWorldInstance(item, { x: display.x, y: display.y });
      worldItem.shopDisplay = true;
      worldItem.shopNpcId = shop.npcId;
      worldItem.timestamp = Date.now();
      return worldItem;
    })).filter(Boolean);
    world.items.push(...shopDisplays);

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
    const x = Math.round(player.x);
    const y = Math.round(player.y);
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
            Math.round(typeof requestedViewport.x === 'number' ? requestedViewport.x : defaultViewport.x),
            size.x - 1,
          ),
        ),
        y: Math.max(
          0,
          Math.min(
            Math.round(typeof requestedViewport.y === 'number' ? requestedViewport.y : defaultViewport.y),
            size.y - 1,
          ),
        ),
      };

      const requestedCenter = options.center || null;
      const center = {
        x: requestedCenter && typeof requestedCenter.x === 'number'
          ? Math.round(requestedCenter.x)
          : Math.floor(viewport.x / 2),
        y: requestedCenter && typeof requestedCenter.y === 'number'
          ? Math.round(requestedCenter.y)
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
