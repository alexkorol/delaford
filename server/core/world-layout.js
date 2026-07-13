import config from '#server/config.js';
import { dungeonGid, dungeonGroupGids } from '#shared/dungeon-tiles.js';

const DEFAULT_MAP_SIZE = { x: 200, y: 200 };
const size = config?.map?.size || DEFAULT_MAP_SIZE;
const WIDTH = size.x || DEFAULT_MAP_SIZE.x;
const HEIGHT = size.y || DEFAULT_MAP_SIZE.y;

// One scene now: the Crossroads. The maps still say Delaford — the drivers
// say the Crossroads. Everything past its four gates is the world web
// (docs/crossroads-world-web.md), generated per House, not laid out here.
const ZONES = {
  town: 'town:delaford',
};

const tile = {
  stoneFloor: dungeonGroupGids('floor', 'stone'),
  greyFloor: dungeonGroupGids('floor', 'grey'),
  marbleFloor: dungeonGroupGids('floor', 'marble'),
  dirtFloor: dungeonGroupGids('floor', 'dirt'),
  mudFloor: dungeonGroupGids('floor', 'mud'),
  lairFloor: dungeonGroupGids('floor', 'lair'),
  water: dungeonGroupGids('liquid', 'water_shallow'),
  brickWall: dungeonGroupGids('wall', 'brick'),
  stoneWall: dungeonGroupGids('wall', 'stone'),
  marbleWall: dungeonGroupGids('wall', 'marble'),
  trees: dungeonGroupGids('tree', 'tree'),
  flowers: dungeonGroupGids('decor_walk', 'flowers'),
  doorOpen: dungeonGid('door_open'),
  portal: dungeonGid('portal'),
  stairsUp: dungeonGid('stairs_up'),
  fountainBlue: dungeonGid('fountain_blue'),
  fountainSparkling: dungeonGid('fountain_sparkling'),
  grate: dungeonGid('grate'),
  statueAngel: dungeonGid('statue_angel'),
  statueArcher: dungeonGid('statue_archer'),
  altar: dungeonGroupGids('decor', 'altar_generic'),
};

const idx = (x, y) => (y * WIDTH) + x;
const inBounds = (x, y) => x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT;

const hash = (x, y, salt = 0) => {
  let value = ((x + 0x9e3779b9) * 73856093) ^ ((y + 0x7f4a7c15) * 19349663) ^ (salt * 83492791);
  value ^= value >>> 13;
  value = Math.imul(value, 1274126177);
  return Math.abs(value ^ (value >>> 16));
};

const pick = (pool, x, y, salt = 0) => {
  if (!Array.isArray(pool) || pool.length === 0) {
    return 0;
  }
  return pool[hash(x, y, salt) % pool.length];
};

const resolve = (value, x, y, salt = 0) => {
  if (typeof value === 'function') {
    return value(x, y);
  }
  if (Array.isArray(value)) {
    return pick(value, x, y, salt);
  }
  return value;
};

const createMap = (basePool, salt = 0) => ({
  background: Array.from({ length: WIDTH * HEIGHT }, (_, index) => {
    const x = index % WIDTH;
    const y = Math.floor(index / WIDTH);
    return pick(basePool, x, y, salt);
  }),
  foreground: new Array(WIDTH * HEIGHT).fill(0),
});

const setBg = (map, x, y, value, salt = 0) => {
  if (inBounds(x, y)) {
    map.background[idx(x, y)] = resolve(value, x, y, salt);
  }
};

const setFg = (map, x, y, value, salt = 0) => {
  if (inBounds(x, y)) {
    map.foreground[idx(x, y)] = resolve(value, x, y, salt);
  }
};

const clearFg = (map, x, y) => setFg(map, x, y, 0);

const openPad = (map, x, y, {
  radius = 1,
  floor = null,
  salt = 0,
} = {}) => {
  for (let yy = y - radius; yy <= y + radius; yy += 1) {
    for (let xx = x - radius; xx <= x + radius; xx += 1) {
      if (!inBounds(xx, yy)) {
        continue;
      }

      setBg(map, xx, yy, floor || map.background[idx(x, y)], salt);
      clearFg(map, xx, yy);
    }
  }
};

const fillRect = (map, x, y, width, height, value, layer = 'background', salt = 0) => {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      if (layer === 'foreground') {
        setFg(map, xx, yy, value, salt);
      } else {
        setBg(map, xx, yy, value, salt);
        clearFg(map, xx, yy);
      }
    }
  }
};

const strokeRect = (map, x, y, width, height, value, layer = 'background', salt = 0) => {
  for (let xx = x; xx < x + width; xx += 1) {
    if (layer === 'foreground') {
      setFg(map, xx, y, value, salt);
      setFg(map, xx, y + height - 1, value, salt);
    } else {
      setBg(map, xx, y, value, salt);
      setBg(map, xx, y + height - 1, value, salt);
    }
  }

  for (let yy = y; yy < y + height; yy += 1) {
    if (layer === 'foreground') {
      setFg(map, x, yy, value, salt);
      setFg(map, x + width - 1, yy, value, salt);
    } else {
      setBg(map, x, yy, value, salt);
      setBg(map, x + width - 1, yy, value, salt);
    }
  }
};

const fillEllipse = (map, cx, cy, radiusX, radiusY, value, layer = 'background', salt = 0) => {
  for (let y = cy - radiusY; y <= cy + radiusY; y += 1) {
    for (let x = cx - radiusX; x <= cx + radiusX; x += 1) {
      const dx = (x - cx) / Math.max(1, radiusX);
      const dy = (y - cy) / Math.max(1, radiusY);
      if ((dx * dx) + (dy * dy) <= 1) {
        if (layer === 'foreground') {
          setFg(map, x, y, value, salt);
        } else {
          setBg(map, x, y, value, salt);
          clearFg(map, x, y);
        }
      }
    }
  }
};

const carveHorizontal = (map, x1, x2, y, halfWidth, value, salt = 0) => {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  for (let x = minX; x <= maxX; x += 1) {
    for (let offset = -halfWidth; offset <= halfWidth; offset += 1) {
      setBg(map, x, y + offset, value, salt);
      clearFg(map, x, y + offset);
    }
  }
};

const carveVertical = (map, x, y1, y2, halfWidth, value, salt = 0) => {
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  for (let y = minY; y <= maxY; y += 1) {
    for (let offset = -halfWidth; offset <= halfWidth; offset += 1) {
      setBg(map, x + offset, y, value, salt);
      clearFg(map, x + offset, y);
    }
  }
};

const addBuilding = (map, {
  x,
  y,
  width,
  height,
  floor = tile.marbleFloor,
  wall = tile.brickWall,
  door = { x: Math.floor(width / 2), y: height - 1 },
  salt = 0,
}) => {
  fillRect(map, x, y, width, height, floor, 'background', salt);
  strokeRect(map, x, y, width, height, wall, 'background', salt + 1);

  if (!door) {
    return;
  }

  const doorX = x + door.x;
  const doorY = y + door.y;
  setFg(map, doorX, doorY, tile.doorOpen);

  if (door.y === 0) {
    setBg(map, doorX, doorY - 1, floor, salt);
  } else if (door.y === height - 1) {
    setBg(map, doorX, doorY + 1, floor, salt);
  } else if (door.x === 0) {
    setBg(map, doorX - 1, doorY, floor, salt);
  } else if (door.x === width - 1) {
    setBg(map, doorX + 1, doorY, floor, salt);
  }
};

const addGrove = (map, x, y, width, height, treePool = tile.trees, density = 3, salt = 0) => {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      if (hash(xx, yy, salt) % 10 < density) {
        setFg(map, xx, yy, treePool, salt);
      }
    }
  }
};

const addFlowers = (map, x, y, width, height, density = 2, salt = 0) => {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      if (hash(xx, yy, salt) % 10 < density) {
        setFg(map, xx, yy, tile.flowers, salt);
      }
    }
  }
};

const addPortal = (scene, map, {
  id,
  name,
  x,
  y,
  tileId = tile.portal,
  floor = null,
  destination,
  message,
}) => {
  openPad(map, x, y, { radius: 1, floor });
  setFg(map, x, y, tileId);
  scene.metadata.portals.push({
    id,
    name,
    x,
    y,
    destination,
    message,
  });
};

const clearSceneSpawnPads = (scene, map) => {
  const spawnPoints = Array.isArray(scene.metadata.spawnPoints)
    ? scene.metadata.spawnPoints
    : [];

  spawnPoints.forEach((spawn) => {
    if (spawn && Number.isFinite(spawn.x) && Number.isFinite(spawn.y)) {
      openPad(map, spawn.x, spawn.y);
    }
  });
};

const makeScene = ({
  id,
  type,
  name,
  persistent = true,
  map,
  spawnPoints,
  portals = [],
  metadata = {},
}) => ({
  id,
  type,
  name,
  persistent,
  map,
  npcs: [],
  items: [],
  respawns: {
    items: [],
    monsters: [],
    resources: [],
  },
  metadata: {
    spawnPoints,
    portals,
    monsterDefinitions: [],
    ...metadata,
  },
});

// Wagon pitches ring the plaza off the road axes: two per quadrant, each a
// 3x3 packed-earth pad. A House's wagon (its quartermaster) stands here while
// any of its scions are on the ground; scions log in at their House's pitch.
const WAGON_PITCHES = [
  { x: 47, y: 112 },
  { x: 42, y: 109 },
  { x: 34, y: 109 },
  { x: 29, y: 112 },
  { x: 29, y: 118 },
  { x: 34, y: 121 },
  { x: 42, y: 121 },
  { x: 47, y: 118 },
];

const createCrossroadsScene = () => {
  const map = createMap(tile.lairFloor, 11);
  const scene = makeScene({
    id: ZONES.town,
    type: 'town',
    name: 'The Crossroads',
    map,
    spawnPoints: [{ x: 42, y: 115 }],
    metadata: {
      // Truce-ground: no blade drawn where the roads cross. Nothing may deal
      // or take damage in this scene.
      sanctuary: true,
      wagonPitches: WAGON_PITCHES,
    },
  });

  // Market ground: the plaza the four waymarks square.
  fillEllipse(map, 38, 115, 15, 10, tile.greyFloor, 'background', 20);
  fillRect(map, 31, 110, 15, 11, tile.stoneFloor, 'background', 21);

  // The four roads, crossing true at the fountain.
  carveVertical(map, 38, 94, 110, 1, tile.dirtFloor, 22);
  carveVertical(map, 38, 121, 138, 1, tile.dirtFloor, 23);
  carveHorizontal(map, 12, 30, 115, 1, tile.dirtFloor, 24);
  carveHorizontal(map, 46, 66, 115, 1, tile.dirtFloor, 25);

  // Market wall with a gate on each road.
  strokeRect(map, 12, 94, 53, 45, tile.stoneWall, 'background', 30);

  // Bazaar structures. Coordinates are load-bearing: the arms and general
  // stalls hold the shop displays (data/foreground/shops.js), and the
  // countinghouse door is where Rhea keeps personal storage (npc id 4).
  addBuilding(map, { x: 14, y: 102, width: 11, height: 9, floor: tile.marbleFloor, wall: tile.brickWall, door: { x: 5, y: 8 }, salt: 40 });
  addBuilding(map, { x: 43, y: 98, width: 12, height: 9, floor: tile.marbleFloor, wall: tile.brickWall, door: { x: 5, y: 8 }, salt: 41 });
  addBuilding(map, { x: 23, y: 122, width: 12, height: 9, floor: tile.marbleFloor, wall: tile.marbleWall, door: { x: 8, y: 0 }, salt: 43 });
  addBuilding(map, { x: 48, y: 117, width: 12, height: 9, floor: tile.stoneFloor, wall: tile.stoneWall, door: { x: 0, y: 5 }, salt: 42 });

  // Wagon pitches: packed earth pads around the plaza.
  WAGON_PITCHES.forEach((pitch, order) => {
    fillRect(map, pitch.x - 1, pitch.y - 1, 3, 3, tile.mudFloor, 'background', 50 + order);
  });

  // The waymark stones and the fountain where the roads cross.
  setFg(map, 38, 115, tile.fountainBlue);
  setFg(map, 35, 112, tile.statueAngel);
  setFg(map, 41, 112, tile.statueAngel);
  setFg(map, 35, 118, tile.statueAngel);
  setFg(map, 41, 118, tile.statueAngel);
  setFg(map, 31, 103, tile.fountainSparkling);
  setFg(map, 53, 121, tile.grate);
  setFg(map, 57, 121, tile.grate);

  // Greenery: the world past the wall is the Weathering's business.
  addFlowers(map, 31, 110, 15, 11, 2, 60);
  addGrove(map, 2, 84, 77, 9, tile.trees, 4, 61);
  addGrove(map, 3, 140, 75, 16, tile.trees, 4, 62);
  addGrove(map, 67, 94, 17, 43, tile.trees, 4, 63);
  addGrove(map, 1, 96, 10, 41, tile.trees, 4, 64);
  fillEllipse(map, 74, 129, 8, 5, tile.water, 'background', 65);
  addFlowers(map, 69, 122, 12, 10, 3, 66);

  // The four road gates. Stepping through opens that road's Wayfinder's
  // Chart (zone-service.openRoadChart via world-transitions).
  addPortal(scene, map, {
    id: 'gate-tin-road',
    name: 'The Tin Road',
    x: 38,
    y: 94,
    floor: tile.dirtFloor,
    destination: { road: 'tin' },
    message: 'The Tin Road runs north into the old quarry country.',
  });
  addPortal(scene, map, {
    id: 'gate-salt-road',
    name: 'The Salt Road',
    x: 64,
    y: 115,
    floor: tile.dirtFloor,
    destination: { road: 'salt' },
    message: 'The Salt Road runs east through the fens.',
  });
  addPortal(scene, map, {
    id: 'gate-chalk-road',
    name: 'The Chalk Road',
    x: 38,
    y: 138,
    floor: tile.dirtFloor,
    destination: { road: 'chalk' },
    message: 'The Chalk Road runs south over the downs and their graves.',
  });
  addPortal(scene, map, {
    id: 'gate-copper-road',
    name: 'The Copper Road',
    x: 12,
    y: 115,
    floor: tile.dirtFloor,
    destination: { road: 'copper' },
    message: 'The Copper Road runs west into the burnt hills.',
  });

  // Keep every pitch and spawn walkable no matter what decor landed there.
  WAGON_PITCHES.forEach((pitch) => {
    openPad(map, pitch.x, pitch.y, { radius: 1, floor: tile.mudFloor });
  });
  clearSceneSpawnPads(scene, map);

  return scene;
};

export const createWorldLayout = () => {
  const town = createCrossroadsScene();
  return { town, scenes: [], zones: ZONES };
};

export default createWorldLayout;
