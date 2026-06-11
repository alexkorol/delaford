import { armor, jewelry, weapons } from '#server/core/data/respawn/index.js';

import MapUtils from '#shared/map-utils.js';
import PF from 'pathfinding';
import UI from '#shared/ui.js';
import config from '#server/config.js';
import surfaceMap from '#server/maps/layers/surface.json' with { type: 'json' };
import { dungeonGid, dungeonGroupGids } from '#shared/dungeon-tiles.js';
import ItemFactory from './items/factory.js';
import { Shop } from './functions/index.js';
import world from './world.js';

const DEFAULT_INSTANCE_ROOM_COUNT = 6;
const DEFAULT_CORRIDOR_WIDTH = 3;

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
      const pieces = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < pieces; i += 1) {
        const pool = pools[Math.floor(rng() * pools.length)];
        const x = room.x + 1 + Math.floor(rng() * Math.max(1, room.width - 2));
        const y = room.y + 1 + Math.floor(rng() * Math.max(1, room.height - 2));
        const onSpawn = roomIndex === 0
          && Math.abs(x - entry.x) <= 2 && Math.abs(y - entry.y) <= 2;
        if (isFloor(x, y) && !foreground[idx(x, y)] && !onSpawn) {
          foreground[idx(x, y)] = pool[Math.floor(rng() * pool.length)];
        }
      }

      // Marsh-style themes get small water pools in roomy chambers.
      if (theme.water && room.width >= 9 && room.height >= 9 && rng() < 0.7) {
        const waterGid = dungeonGroupGids('liquid', 'water_shallow')[0];
        if (waterGid) {
          const px = room.x + 2 + Math.floor(rng() * (room.width - 5));
          const py = room.y + 2 + Math.floor(rng() * (room.height - 5));
          for (let dy = 0; dy < 2; dy += 1) {
            for (let dx = 0; dx < 2; dx += 1) {
              if (!foreground[idx(px + dx, py + dy)]) {
                background[idx(px + dx, py + dy)] = waterGid;
              }
            }
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
    // template's theme on floor 1.
    const themeNames = Object.keys(INSTANCE_THEMES);
    const baseThemeIndex = Math.max(0, themeNames.indexOf(baseThemeName));
    const themeName = themeNames[(baseThemeIndex + (depth - 1)) % themeNames.length];
    const theme = INSTANCE_THEMES[themeName] || INSTANCE_THEMES.stone;

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

    const rooms = Math.max(1, options.rooms || DEFAULT_INSTANCE_ROOM_COUNT);
    const carvedRooms = [];
    const roomRects = [];

    for (let index = 0; index < rooms; index += 1) {
      const roomWidth = Math.max(6, Math.floor(rng() * 12) + 6);
      const roomHeight = Math.max(6, Math.floor(rng() * 12) + 6);
      const marginX = Math.max(2, Math.floor(width * 0.05));
      const marginY = Math.max(2, Math.floor(height * 0.05));
      const originX = Math.min(
        width - roomWidth - 1,
        Math.max(marginX, Math.floor(rng() * (width - roomWidth - marginX))),
      );
      const originY = Math.min(
        height - roomHeight - 1,
        Math.max(marginY, Math.floor(rng() * (height - roomHeight - marginY))),
      );

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
      const corridorWidth = Math.max(2, options.corridorWidth || DEFAULT_CORRIDOR_WIDTH);
      const anchor = carvedRooms[0];
      carvedRooms.slice(1).forEach((roomCenter) => {
        Map.carveCorridor(background, foreground, anchor, roomCenter, corridorWidth, floorPicker, rng);
      });
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
      roomRects,
      carvedRooms,
    });

    const depthLevelBonus = (depth - 1) * 2;
    const depthRewardMultiplier = 1 + ((depth - 1) * 0.35);

    const monsterSpawns = carvedRooms.slice(1);
    const roleCycle = ['melee', 'ranged', 'support'];
    const instanceMonsters = monsterSpawns.map((center, index) => {
      const role = roleCycle[index % roleCycle.length];
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
        behaviour.support = {
          healAmount: 20 + (index * 5),
          healRange: 6,
        };
      }

      const archetype = role === 'ranged' ? 'mystic' : (role === 'support' ? 'mystic' : 'brute');
      const rarity = index % 3 === 2 ? 'rare' : (index % 3 === 1 ? 'uncommon' : 'common');

      return {
        id: `instance-${seed}-${index}`,
        name: role === 'support'
          ? 'Celestial Channeler'
          : role === 'ranged'
            ? 'Ashen Marksman'
            : 'Dread Vanguard',
        level: Math.max(4, Math.floor(5 + (index * 0.75))) + depthLevelBonus,
        archetype,
        rarity,
        spawn: {
          x: center.x,
          y: center.y,
          radius: 2,
        },
        behaviour,
        rewards: {
          experience: Math.round((30 + (index * 18)) * depthRewardMultiplier),
          coins: Math.round((60 + (index * 20)) * depthRewardMultiplier),
        },
        respawn: {
          delayMs: 600000,
        },
      };
    });

    // Players spawn on the walkable tiles around the entry stairs,
    // never on the stairs themselves (stepping on them transitions).
    const entry = carvedRooms[0];
    const exit = carvedRooms.length > 1 ? carvedRooms[carvedRooms.length - 1] : null;
    const idx = (x, y) => (y * width) + x;
    const spawnPoints = [
      { x: entry.x + 1, y: entry.y },
      { x: entry.x - 1, y: entry.y },
      { x: entry.x, y: entry.y + 1 },
      { x: entry.x, y: entry.y - 1 },
    ].filter((tile) => {
      const bgWalkable = UI.tileWalkable(background[idx(tile.x, tile.y)] - 1);
      const fgGid = foreground[idx(tile.x, tile.y)];
      return bgWalkable && (!fgGid || UI.tileWalkable(fgGid - 1, 'foreground'));
    });

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
        spawnPoints,
        roomCentres: carvedRooms,
        stairsUp: { x: entry.x, y: entry.y },
        stairsDown: exit ? { x: exit.x, y: exit.y } : null,
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
      items: [],
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
  static findQuickestPath(x, y, playerIndex) {
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
      const grid = typeof player.path.grid.clone === 'function'
        ? player.path.grid.clone()
        : player.path.grid;

      /**
       * Get location of all 4 spots, check tile if blocked
       * Get direction based off player and where to check first
       */

      const path = player.path.finder.findPath(center.x, center.y, x, y, grid);
      resolve(path);
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
    const path = await Map.findQuickestPath(x, y, playerIndex);

    // Since we are performing an action on a resource or tile,
    // let's end the path one step so we don't step on it.
    // (For example, mining block, tree, door, etc.)
    if (location === 'edge') {
      path.pop();
    }

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
  async setUp() {
    // Load the board
    const board = await Map.load();

    // Set background and foreground tile data
    this.background = board[0].data;
    this.foreground = board[1].data;

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
