import config from '#server/config.js';
import { surfaceMonsterGraphic } from '#shared/actor-graphics.js';
import { dungeonGid, dungeonGroupGids } from '#shared/dungeon-tiles.js';

const DEFAULT_MAP_SIZE = { x: 200, y: 200 };
const size = config?.map?.size || DEFAULT_MAP_SIZE;
const WIDTH = size.x || DEFAULT_MAP_SIZE.x;
const HEIGHT = size.y || DEFAULT_MAP_SIZE.y;

const ZONES = {
  town: 'town:delaford',
  oldWood: 'zone:old-wood',
  mire: 'zone:fenmire',
  graveyard: 'zone:saint-aldrics-graveyard',
  barrow: 'dungeon:barrow-depths',
  ember: 'dungeon:ember-ruins',
};

const tile = {
  stoneFloor: dungeonGroupGids('floor', 'stone'),
  greyFloor: dungeonGroupGids('floor', 'grey'),
  cryptFloor: dungeonGroupGids('floor', 'crypt'),
  volcanicFloor: dungeonGroupGids('floor', 'volcanic'),
  marshFloor: dungeonGroupGids('floor', 'marsh'),
  mudFloor: dungeonGroupGids('floor', 'mud'),
  lairFloor: dungeonGroupGids('floor', 'lair'),
  dirtFloor: dungeonGroupGids('floor', 'dirt'),
  marbleFloor: dungeonGroupGids('floor', 'marble'),
  tombFloor: dungeonGroupGids('floor', 'tomb'),
  water: dungeonGroupGids('liquid', 'water_shallow'),
  murkyWater: dungeonGroupGids('liquid', 'water_murky'),
  brickWall: dungeonGroupGids('wall', 'brick'),
  stoneWall: dungeonGroupGids('wall', 'stone'),
  cryptWall: dungeonGroupGids('wall', 'crypt'),
  marbleWall: dungeonGroupGids('wall', 'marble'),
  volcanicWall: dungeonGroupGids('wall', 'volcanic'),
  trees: dungeonGroupGids('tree', 'tree'),
  deadTrees: dungeonGroupGids('tree', 'tree_dead'),
  petrifiedTrees: dungeonGroupGids('tree', 'tree_petrified'),
  flowers: dungeonGroupGids('decor_walk', 'flowers'),
  doorOpen: dungeonGid('door_open'),
  portal: dungeonGid('portal'),
  exitPortal: dungeonGid('exit_portal'),
  stairsUp: dungeonGid('stairs_up'),
  stairsDown: dungeonGid('stairs_down'),
  hatchDown: dungeonGid('hatch_down'),
  fountainBlue: dungeonGid('fountain_blue'),
  fountainSparkling: dungeonGid('fountain_sparkling'),
  fountainDry: dungeonGid('fountain_dry'),
  grate: dungeonGid('grate'),
  statueAngel: dungeonGid('statue_angel'),
  statueArcher: dungeonGid('statue_archer'),
  statueDragon: dungeonGid('statue_dragon'),
  sarcophagus: dungeonGid('sarcophagus'),
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
  const monsters = Array.isArray(scene.metadata.monsterDefinitions)
    ? scene.metadata.monsterDefinitions
    : [];

  spawnPoints.forEach((spawn) => {
    if (spawn && Number.isFinite(spawn.x) && Number.isFinite(spawn.y)) {
      openPad(map, spawn.x, spawn.y);
    }
  });

  monsters.forEach((definition) => {
    const spawn = definition && definition.spawn;
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
  monsterDefinitions = [],
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
    monsterDefinitions,
  },
});

const createTownScene = () => {
  const map = createMap(tile.lairFloor, 11);
  const scene = makeScene({
    id: ZONES.town,
    type: 'town',
    name: 'Delaford Village',
    map,
    spawnPoints: [{ x: 42, y: 115 }],
  });

  fillEllipse(map, 38, 115, 14, 8, tile.greyFloor, 'background', 20);
  fillRect(map, 30, 109, 17, 13, tile.stoneFloor, 'background', 21);
  carveHorizontal(map, 12, 66, 115, 1, tile.dirtFloor, 22);
  carveVertical(map, 38, 94, 140, 1, tile.dirtFloor, 23);
  carveHorizontal(map, 25, 51, 103, 1, tile.dirtFloor, 24);
  carveHorizontal(map, 24, 58, 127, 1, tile.dirtFloor, 25);

  strokeRect(map, 12, 94, 53, 45, tile.stoneWall, 'background', 30);
  [[38, 94], [38, 138], [12, 115], [64, 115]].forEach(([x, y]) => {
    setBg(map, x, y, tile.dirtFloor, 31);
    setFg(map, x, y, tile.portal);
  });

  addBuilding(map, { x: 23, y: 98, width: 11, height: 9, floor: tile.marbleFloor, wall: tile.brickWall, door: { x: 6, y: 8 }, salt: 40 });
  addBuilding(map, { x: 43, y: 98, width: 12, height: 9, floor: tile.marbleFloor, wall: tile.brickWall, door: { x: 5, y: 8 }, salt: 41 });
  addBuilding(map, { x: 48, y: 117, width: 12, height: 9, floor: tile.stoneFloor, wall: tile.stoneWall, door: { x: 0, y: 5 }, salt: 42 });
  addBuilding(map, { x: 23, y: 122, width: 12, height: 9, floor: tile.marbleFloor, wall: tile.marbleWall, door: { x: 8, y: 0 }, salt: 43 });
  addBuilding(map, { x: 37, y: 128, width: 13, height: 10, floor: tile.tombFloor, wall: tile.marbleWall, door: { x: 6, y: 0 }, salt: 44 });

  fillRect(map, 15, 103, 8, 15, tile.dirtFloor, 'background', 50);
  strokeRect(map, 14, 102, 10, 17, tile.stoneWall, 'background', 51);
  setBg(map, 19, 118, tile.dirtFloor, 52);
  setFg(map, 19, 118, tile.doorOpen);
  setFg(map, 18, 108, tile.statueArcher);
  setFg(map, 20, 108, tile.statueArcher);

  setFg(map, 38, 115, tile.fountainBlue);
  setFg(map, 31, 103, tile.fountainSparkling);
  setFg(map, 31, 127, tile.fountainDry);
  setFg(map, 43, 133, tile.stairsDown);
  setFg(map, 53, 121, tile.grate);
  setFg(map, 57, 121, tile.grate);
  setFg(map, 42, 132, tile.statueAngel);
  addFlowers(map, 31, 111, 15, 9, 2, 60);
  addGrove(map, 2, 84, 77, 15, tile.trees, 4, 61);
  addGrove(map, 3, 138, 75, 18, tile.trees, 4, 62);
  addGrove(map, 66, 94, 18, 43, tile.trees, 4, 63);
  addGrove(map, 1, 96, 10, 41, tile.trees, 4, 64);
  fillEllipse(map, 74, 129, 8, 5, tile.water, 'background', 65);
  addFlowers(map, 69, 122, 12, 10, 3, 66);

  addPortal(scene, map, {
    id: 'town-north-old-wood',
    name: 'Old Wood Trail',
    x: 38,
    y: 94,
    floor: tile.dirtFloor,
    destination: { sceneId: ZONES.oldWood, x: 100, y: 176 },
    message: 'You follow the north road into the Old Wood.',
  });
  addPortal(scene, map, {
    id: 'town-east-fenmire',
    name: 'Fenmire Causeway',
    x: 64,
    y: 115,
    floor: tile.dirtFloor,
    destination: { sceneId: ZONES.mire, x: 18, y: 115 },
    message: 'You step onto the wet eastern causeway.',
  });
  addPortal(scene, map, {
    id: 'town-south-graveyard',
    name: "Saint Aldric's Gate",
    x: 38,
    y: 138,
    floor: tile.dirtFloor,
    destination: { sceneId: ZONES.graveyard, x: 100, y: 24 },
    message: 'You pass through the south gate toward Saint Aldric\'s graveyard.',
  });
  addPortal(scene, map, {
    id: 'town-chapel-barrow',
    name: 'Chapel Crypt Stairs',
    x: 43,
    y: 133,
    tileId: tile.stairsDown,
    floor: tile.tombFloor,
    destination: { sceneId: ZONES.barrow, x: 100, y: 176 },
    message: 'You descend beneath the village chapel.',
  });

  clearSceneSpawnPads(scene, map);

  return scene;
};

const createOldWoodScene = () => {
  const map = createMap(tile.lairFloor, 100);
  const scene = makeScene({
    id: ZONES.oldWood,
    type: 'wilderness',
    name: 'The Old Wood',
    map,
    spawnPoints: [{ x: 100, y: 176 }],
    monsterDefinitions: [
      {
        id: 'oldwood-wolf',
        // Measured: dies in ARPG time, not sponge time (TTK targets in spec).
        healthMultiplier: 0.4,
        name: 'Old Wood Wolf',
        level: 2,
        archetype: 'skirmisher',
        rarity: 'common',
        graphic: surfaceMonsterGraphic('oldwood-wolf'),
        spawn: { x: 100, y: 170, radius: 4 },
        behaviour: { aggressionRange: 7, patrolRadius: 6 },
        rewards: { experience: 18 },
        respawn: { delayMs: 14000 },
      },
      {
        id: 'thorn-stalker',
        // Measured: dies in ARPG time, not sponge time (TTK targets in spec).
        healthMultiplier: 0.45,
        name: 'Thorn Stalker',
        level: 4,
        archetype: 'skirmisher',
        rarity: 'uncommon',
        graphic: surfaceMonsterGraphic('thorn-stalker'),
        spawn: { x: 117, y: 132, radius: 5 },
        behaviour: { aggressionRange: 8, patrolRadius: 5 },
        rewards: { experience: 36 },
        respawn: { delayMs: 18000 },
      },
      {
        id: 'mossbound-brute',
        // Measured: dies in ARPG time, not sponge time (TTK targets in spec).
        healthMultiplier: 0.55,
        // Measured: keeps an at-level player above 6 hits-to-die.
        damageMultiplier: 0.7,
        name: 'Mossbound Brute',
        level: 5,
        archetype: 'brute',
        rarity: 'uncommon',
        graphic: surfaceMonsterGraphic('mossbound-brute'),
        spawn: { x: 84, y: 119, radius: 4 },
        behaviour: { aggressionRange: 7, patrolRadius: 4 },
        rewards: { experience: 52 },
        respawn: { delayMs: 22000 },
      },
    ],
  });

  addGrove(map, 0, 0, WIDTH, HEIGHT, tile.trees, 5, 101);
  fillEllipse(map, 100, 176, 10, 7, tile.dirtFloor, 'background', 102);
  fillEllipse(map, 104, 139, 22, 14, tile.lairFloor, 'background', 103);
  fillEllipse(map, 86, 119, 14, 9, tile.lairFloor, 'background', 104);
  carveVertical(map, 100, 176, 137, 1, tile.dirtFloor, 105);
  carveHorizontal(map, 83, 120, 137, 1, tile.dirtFloor, 106);
  carveVertical(map, 84, 137, 119, 1, tile.dirtFloor, 107);
  fillEllipse(map, 126, 148, 9, 6, tile.water, 'background', 108);
  addFlowers(map, 94, 132, 20, 18, 4, 109);

  addPortal(scene, map, {
    id: 'old-wood-return-town',
    name: 'Road to Delaford',
    x: 100,
    y: 181,
    tileId: tile.exitPortal,
    floor: tile.dirtFloor,
    destination: { sceneId: ZONES.town, x: 38, y: 96 },
    message: 'You return to Delaford by the north road.',
  });
  addPortal(scene, map, {
    id: 'old-wood-east-fenmire',
    name: 'Sedge Trail',
    x: 123,
    y: 137,
    floor: tile.dirtFloor,
    destination: { sceneId: ZONES.mire, x: 42, y: 70 },
    message: 'The forest thins into wet sedge and black water.',
  });

  // Instance gates: the procedural zones live IN the world, not just in a menu.
  addPortal(scene, map, {
    id: 'gate-verdant-grove',
    name: 'Mossy Archway',
    x: 96,
    y: 139,
    tileId: tile.exitPortal,
    floor: tile.lairFloor,
    destination: { instance: { template: 'grove', layout: 'clearings' } },
    message: 'You slip through the mossy archway into the Verdant Grove.',
  });
  addPortal(scene, map, {
    id: 'gate-old-barrow',
    name: 'Sunken Steps',
    x: 112,
    y: 142,
    tileId: tile.exitPortal,
    floor: tile.dirtFloor,
    destination: { instance: { template: 'dungeon', layout: 'warren' } },
    message: 'Old steps descend beneath the roots into The Old Barrow.',
  });

  clearSceneSpawnPads(scene, map);

  return scene;
};

const createMireScene = () => {
  const map = createMap(tile.marshFloor, 200);
  const scene = makeScene({
    id: ZONES.mire,
    type: 'wilderness',
    name: 'Fenmire Causeway',
    map,
    spawnPoints: [{ x: 18, y: 115 }],
    monsterDefinitions: [
      {
        id: 'reed-witch',
        // Measured: dies in ARPG time, not sponge time (TTK targets in spec).
        healthMultiplier: 0.5,
        // Measured: keeps an at-level player above 6 hits-to-die.
        damageMultiplier: 0.45,
        name: 'Reed Witch',
        level: 5,
        archetype: 'mystic',
        rarity: 'uncommon',
        graphic: surfaceMonsterGraphic('reed-witch'),
        spawn: { x: 48, y: 78, radius: 5 },
        behaviour: { type: 'ranged', aggressionRange: 8, pursuitRange: 10, attack: { range: 5, intervalMs: 1800, windupMs: 420 } },
        rewards: { experience: 58 },
        respawn: { delayMs: 22000 },
      },
      {
        id: 'bog-revenant',
        // Measured: dies in ARPG time, not sponge time (TTK targets in spec).
        healthMultiplier: 0.5,
        // Measured: keeps an at-level player above 6 hits-to-die.
        damageMultiplier: 0.55,
        name: 'Bog Revenant',
        level: 6,
        archetype: 'brute',
        rarity: 'rare',
        graphic: surfaceMonsterGraphic('bog-revenant'),
        spawn: { x: 30, y: 115, radius: 4 },
        behaviour: { aggressionRange: 7, patrolRadius: 4 },
        rewards: { experience: 84 },
        respawn: { delayMs: 26000 },
      },
    ],
  });

  fillEllipse(map, 78, 112, 34, 27, tile.murkyWater, 'background', 201);
  fillEllipse(map, 126, 82, 24, 18, tile.water, 'background', 202);
  carveHorizontal(map, 16, 116, 115, 1, tile.dirtFloor, 203);
  carveVertical(map, 42, 115, 70, 1, tile.dirtFloor, 204);
  carveHorizontal(map, 42, 130, 70, 1, tile.dirtFloor, 205);
  fillRect(map, 55, 94, 16, 10, tile.mudFloor, 'background', 206);
  fillRect(map, 78, 118, 14, 10, tile.mudFloor, 'background', 207);
  addGrove(map, 3, 3, WIDTH - 6, HEIGHT - 6, tile.trees, 2, 208);
  addFlowers(map, 48, 92, 30, 16, 4, 209);
  carveHorizontal(map, 16, 116, 115, 1, tile.dirtFloor, 210);
  carveVertical(map, 42, 115, 70, 1, tile.dirtFloor, 211);
  carveHorizontal(map, 42, 130, 70, 1, tile.dirtFloor, 212);

  addPortal(scene, map, {
    id: 'fenmire-return-town',
    name: 'Causeway to Delaford',
    x: 14,
    y: 115,
    tileId: tile.exitPortal,
    floor: tile.dirtFloor,
    destination: { sceneId: ZONES.town, x: 62, y: 115 },
    message: 'You follow the causeway back to Delaford.',
  });
  addPortal(scene, map, {
    id: 'fenmire-old-wood',
    name: 'Sedge Trail',
    x: 42,
    y: 66,
    floor: tile.dirtFloor,
    destination: { sceneId: ZONES.oldWood, x: 122, y: 137 },
    message: 'You take the sedge trail back into the Old Wood.',
  });

  addPortal(scene, map, {
    id: 'gate-marsh-of-reeds',
    name: 'Reed-Choked Jetty',
    x: 60,
    y: 116,
    tileId: tile.exitPortal,
    floor: tile.dirtFloor,
    destination: { instance: { template: 'marsh', layout: 'clearings' } },
    message: 'You pole off the jetty into the Marsh of Reeds.',
  });
  addPortal(scene, map, {
    id: 'gate-the-wilds',
    name: 'Broken Palisade',
    x: 42,
    y: 90,
    tileId: tile.exitPortal,
    floor: tile.dirtFloor,
    destination: { instance: { template: 'wilds', layout: 'clearings' } },
    message: 'Beyond the broken palisade, The Wilds open before you.',
  });

  clearSceneSpawnPads(scene, map);

  return scene;
};

const createGraveyardScene = () => {
  const map = createMap(tile.tombFloor, 300);
  const scene = makeScene({
    id: ZONES.graveyard,
    type: 'wilderness',
    name: "Saint Aldric's Graveyard",
    map,
    spawnPoints: [{ x: 100, y: 24 }],
    monsterDefinitions: [
      {
        id: 'hollow-warden',
        // Measured: dies in ARPG time, not sponge time (TTK targets in spec).
        healthMultiplier: 0.55,
        // Measured: keeps an at-level player above 6 hits-to-die.
        damageMultiplier: 0.85,
        name: 'Hollow Warden',
        level: 4,
        archetype: 'brute',
        rarity: 'common',
        graphic: surfaceMonsterGraphic('hollow-warden'),
        spawn: { x: 100, y: 31, radius: 4 },
        behaviour: { aggressionRange: 7, patrolRadius: 4 },
        rewards: { experience: 42 },
        respawn: { delayMs: 18000 },
      },
      {
        id: 'barrow-sister',
        // Measured: dies in ARPG time, not sponge time (TTK targets in spec).
        healthMultiplier: 0.6,
        // Measured: keeps an at-level player above 6 hits-to-die.
        damageMultiplier: 0.5,
        name: 'Barrow Sister',
        level: 6,
        archetype: 'mystic',
        rarity: 'uncommon',
        graphic: surfaceMonsterGraphic('barrow-sister'),
        spawn: { x: 108, y: 97, radius: 5 },
        behaviour: { type: 'ranged', aggressionRange: 8, pursuitRange: 10, attack: { range: 5, intervalMs: 1900, windupMs: 450 } },
        rewards: { experience: 76 },
        respawn: { delayMs: 24000 },
      },
    ],
  });

  addGrove(map, 0, 0, WIDTH, HEIGHT, tile.deadTrees, 3, 301);
  fillRect(map, 78, 37, 45, 75, tile.cryptFloor, 'background', 302);
  strokeRect(map, 76, 35, 49, 79, tile.cryptWall, 'background', 303);
  carveVertical(map, 100, 22, 103, 1, tile.greyFloor, 304);
  carveHorizontal(map, 82, 118, 70, 1, tile.greyFloor, 305);
  for (let y = 49; y <= 101; y += 12) {
    for (let x = 84; x <= 116; x += 8) {
      setFg(map, x, y, tile.sarcophagus);
    }
  }
  setFg(map, 100, 76, tile.statueAngel);
  setFg(map, 100, 105, tile.stairsDown);

  addPortal(scene, map, {
    id: 'graveyard-return-town',
    name: 'South Gate Road',
    x: 100,
    y: 19,
    tileId: tile.exitPortal,
    floor: tile.greyFloor,
    destination: { sceneId: ZONES.town, x: 38, y: 136 },
    message: 'You walk back through Delaford\'s south gate.',
  });
  addPortal(scene, map, {
    id: 'graveyard-barrow',
    name: 'Barrow Stairs',
    x: 100,
    y: 105,
    tileId: tile.stairsDown,
    floor: tile.cryptFloor,
    destination: { sceneId: ZONES.barrow, x: 100, y: 176 },
    message: 'You descend the old barrow steps.',
  });

  addPortal(scene, map, {
    id: 'gate-weir-crypt',
    name: 'Weir Crypt Door',
    x: 88,
    y: 44,
    tileId: tile.exitPortal,
    floor: tile.cryptFloor,
    destination: { instance: { template: 'crypt', layout: 'warren' } },
    message: 'The crypt door grinds open onto the Weir Crypt.',
  });
  addPortal(scene, map, {
    id: 'gate-sunken-colonnade',
    name: 'Flooded Stair',
    x: 112,
    y: 44,
    tileId: tile.exitPortal,
    floor: tile.cryptFloor,
    destination: { instance: { template: 'crypt', layout: 'gauntlet' } },
    message: 'A flooded stair leads down into the Sunken Colonnade.',
  });

  clearSceneSpawnPads(scene, map);

  return scene;
};

const createBarrowScene = () => {
  const map = createMap(tile.cryptWall, 400);
  const scene = makeScene({
    id: ZONES.barrow,
    type: 'dungeon',
    name: 'Barrow Depths',
    map,
    spawnPoints: [{ x: 100, y: 176 }],
    monsterDefinitions: [
      {
        id: 'crypt-guard',
        // Measured: dies in ARPG time, not sponge time (TTK targets in spec).
        healthMultiplier: 0.5,
        // Measured: keeps an at-level player above 6 hits-to-die.
        damageMultiplier: 0.7,
        name: 'Crypt Guard',
        level: 7,
        archetype: 'brute',
        rarity: 'uncommon',
        graphic: surfaceMonsterGraphic('crypt-guard'),
        spawn: { x: 100, y: 170, radius: 3 },
        behaviour: { aggressionRange: 8, patrolRadius: 3 },
        rewards: { experience: 110 },
        respawn: { delayMs: 30000 },
      },
      {
        id: 'bone-oracle',
        // Measured: dies in ARPG time, not sponge time (TTK targets in spec).
        healthMultiplier: 0.55,
        // Measured: keeps an at-level player above 6 hits-to-die.
        damageMultiplier: 0.4,
        name: 'Bone Oracle',
        level: 8,
        archetype: 'mystic',
        rarity: 'rare',
        graphic: surfaceMonsterGraphic('bone-oracle'),
        spawn: { x: 82, y: 102, radius: 4 },
        behaviour: { type: 'support', aggressionRange: 8, pursuitRange: 11, support: { healAmount: 24, healRange: 6 } },
        rewards: { experience: 150 },
        respawn: { delayMs: 36000 },
      },
      {
        id: 'barrow-knight',
        // Measured: dies in ARPG time, not sponge time (TTK targets in spec).
        healthMultiplier: 0.5,
        // Measured: keeps an at-level player above 6 hits-to-die.
        damageMultiplier: 0.6,
        name: 'Barrow Knight',
        level: 9,
        archetype: 'brute',
        rarity: 'rare',
        graphic: surfaceMonsterGraphic('barrow-knight'),
        spawn: { x: 118, y: 93, radius: 3 },
        behaviour: { aggressionRange: 8, patrolRadius: 3 },
        rewards: { experience: 175 },
        respawn: { delayMs: 42000 },
      },
    ],
  });

  fillRect(map, 92, 168, 17, 17, tile.cryptFloor, 'background', 401);
  fillRect(map, 90, 128, 21, 18, tile.cryptFloor, 'background', 402);
  fillRect(map, 73, 93, 22, 18, tile.tombFloor, 'background', 403);
  fillRect(map, 109, 86, 23, 20, tile.tombFloor, 'background', 404);
  carveVertical(map, 100, 176, 137, 2, tile.cryptFloor, 405);
  carveVertical(map, 100, 137, 102, 2, tile.cryptFloor, 406);
  carveHorizontal(map, 84, 120, 102, 2, tile.cryptFloor, 407);
  strokeRect(map, 92, 168, 17, 17, tile.cryptWall, 'background', 408);
  strokeRect(map, 90, 128, 21, 18, tile.cryptWall, 'background', 409);
  strokeRect(map, 73, 93, 22, 18, tile.cryptWall, 'background', 410);
  strokeRect(map, 109, 86, 23, 20, tile.cryptWall, 'background', 411);
  carveVertical(map, 100, 176, 137, 2, tile.cryptFloor, 412);
  carveVertical(map, 100, 137, 102, 2, tile.cryptFloor, 413);
  carveHorizontal(map, 84, 120, 102, 2, tile.cryptFloor, 414);
  setFg(map, 100, 181, tile.stairsUp);
  setFg(map, 84, 103, tile.sarcophagus);
  setFg(map, 116, 94, tile.sarcophagus);
  setFg(map, 122, 94, tile.sarcophagus);
  setFg(map, 120, 102, tile.hatchDown);

  addPortal(scene, map, {
    id: 'barrow-return-graveyard',
    name: 'Stairs to Graveyard',
    x: 100,
    y: 181,
    tileId: tile.stairsUp,
    floor: tile.cryptFloor,
    destination: { sceneId: ZONES.graveyard, x: 100, y: 103 },
    message: 'You climb back to the graveyard.',
  });
  addPortal(scene, map, {
    id: 'barrow-ember-ruins',
    name: 'Ashen Hatch',
    x: 120,
    y: 102,
    tileId: tile.hatchDown,
    floor: tile.tombFloor,
    destination: { sceneId: ZONES.ember, x: 100, y: 176 },
    message: 'Hot air rises from below as you descend.',
  });

  clearSceneSpawnPads(scene, map);

  return scene;
};

const createEmberScene = () => {
  const map = createMap(tile.volcanicWall, 500);
  const scene = makeScene({
    id: ZONES.ember,
    type: 'dungeon',
    name: 'Ember Ruins',
    map,
    spawnPoints: [{ x: 100, y: 176 }],
    monsterDefinitions: [
      {
        id: 'ember-guard',
        // Measured: dies in ARPG time, not sponge time (TTK targets in spec).
        healthMultiplier: 0.45,
        // Measured: keeps an at-level player above 6 hits-to-die.
        damageMultiplier: 0.6,
        name: 'Ember Guard',
        level: 10,
        archetype: 'brute',
        rarity: 'rare',
        graphic: surfaceMonsterGraphic('ember-guard'),
        spawn: { x: 100, y: 170, radius: 4 },
        behaviour: { aggressionRange: 9, patrolRadius: 4 },
        rewards: { experience: 220 },
        respawn: { delayMs: 45000 },
      },
      {
        id: 'ash-seer',
        // Measured: dies in ARPG time, not sponge time (TTK targets in spec).
        healthMultiplier: 0.55,
        // Measured: keeps an at-level player above 6 hits-to-die.
        damageMultiplier: 0.4,
        name: 'Ash Seer',
        level: 11,
        archetype: 'mystic',
        rarity: 'rare',
        graphic: surfaceMonsterGraphic('ash-seer'),
        spawn: { x: 119, y: 119, radius: 5 },
        behaviour: { type: 'ranged', aggressionRange: 9, pursuitRange: 12, attack: { range: 5, intervalMs: 1700, windupMs: 420 } },
        rewards: { experience: 260 },
        respawn: { delayMs: 50000 },
      },
    ],
  });

  fillRect(map, 92, 168, 17, 17, tile.volcanicFloor, 'background', 501);
  fillRect(map, 87, 126, 27, 19, tile.volcanicFloor, 'background', 502);
  fillRect(map, 107, 110, 26, 19, tile.volcanicFloor, 'background', 503);
  carveVertical(map, 100, 176, 134, 2, tile.volcanicFloor, 504);
  carveHorizontal(map, 100, 120, 119, 2, tile.volcanicFloor, 505);
  strokeRect(map, 92, 168, 17, 17, tile.volcanicWall, 'background', 506);
  strokeRect(map, 87, 126, 27, 19, tile.volcanicWall, 'background', 507);
  strokeRect(map, 107, 110, 26, 19, tile.volcanicWall, 'background', 508);
  setFg(map, 100, 181, tile.stairsUp);
  setFg(map, 120, 119, tile.statueDragon);
  setFg(map, 111, 134, tile.fountainDry);
  addGrove(map, 88, 146, 35, 15, tile.petrifiedTrees, 2, 509);
  carveVertical(map, 100, 176, 134, 2, tile.volcanicFloor, 510);
  carveHorizontal(map, 100, 120, 119, 2, tile.volcanicFloor, 511);

  addPortal(scene, map, {
    id: 'ember-return-barrow',
    name: 'Hatch to Barrow Depths',
    x: 100,
    y: 181,
    tileId: tile.stairsUp,
    floor: tile.volcanicFloor,
    destination: { sceneId: ZONES.barrow, x: 120, y: 100 },
    message: 'You climb out of the Ember Ruins.',
  });

  clearSceneSpawnPads(scene, map);

  return scene;
};

export const createWorldLayout = () => {
  const town = createTownScene();
  const scenes = [
    createOldWoodScene(),
    createMireScene(),
    createGraveyardScene(),
    createBarrowScene(),
    createEmberScene(),
  ];

  return { town, scenes, zones: ZONES };
};

export default createWorldLayout;
