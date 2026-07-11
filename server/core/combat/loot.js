import ItemFactory from '#server/core/items/factory.js';
import { autoPickupCurrency } from '#server/core/items/pickup.js';
import Socket from '#server/socket.js';
import world from '#server/core/world.js';
import config from '#server/config.js';
import UI from '#shared/ui.js';
import { drawCirculatingRelic } from '#server/core/services/chronicles.js';

// Chance a slain monster drops a piece of gear, by rarity tier
export const GEAR_DROP_CHANCES = {
  common: 0.05,
  uncommon: 0.1,
  rare: 0.2,
  elite: 0.5,
};

export const RELIC_DROP_CHANCE = 0.12;

// A spread across weapon types, every armour slot, and jewelry so drops feel
// varied rather than the same handful of swords.
export const GEAR_DROP_POOL = [
  // weapons — different families
  'bronze-sword',
  'bronze-dagger',
  'bronze-mace',
  'bronze-battleaxe',
  'bronze-spear',
  'flint-spear',
  'bronze-pike',
  'skymetal-longsword',
  'iron-sword',
  'iron-dagger',
  'iron-warhammer',
  'shortbow',
  'longbow',
  // armour — head/body/hands/feet/back/offhand
  'bronze-helm',
  'bronze-med-helm',
  'bronze-armor',
  'bronze-chainmail',
  'bronze-gloves',
  'bronze-boots',
  'bronze-shield',
  'iron-helm',
  'iron-armor',
  'iron-gloves',
  'iron-boots',
  'iron-shield',
  'leather-cowl',
  'cape',
  'hide-wrap',
  'bronze-scale-vest',
  'bronze-war-helm',
  'hide-sandals',
  'bronze-roundshield',
  // jewelry
  'ring',
  'gold-ring',
  'garnet-amulet',
  'jade-gorget',
  'copper-coil',
];

const sameTile = (left, right) => (
  left
  && right
  && left.x === right.x
  && left.y === right.y
);

const transitionTiles = (scene) => {
  const metadata = scene && scene.metadata ? scene.metadata : {};
  return [
    metadata.stairsUp,
    metadata.stairsDown,
    ...(Array.isArray(metadata.portals) ? metadata.portals : []),
  ].filter(Boolean);
};

const isSafeLootTile = (scene, x, y) => {
  const map = scene && scene.map;
  const width = config.map.size.x;
  const height = config.map.size.y;
  if (!map || !Array.isArray(map.background) || !Array.isArray(map.foreground)) {
    return true;
  }
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return false;
  }
  if (transitionTiles(scene).some(tile => sameTile(tile, { x, y }))) {
    return false;
  }

  const index = (y * width) + x;
  const background = map.background[index];
  const foreground = map.foreground[index];
  const backgroundWalkable = Number.isFinite(background)
    && UI.tileWalkable(background - 1, 'background');
  const foregroundWalkable = !foreground || UI.tileWalkable(foreground - 1, 'foreground');
  return backgroundWalkable && foregroundWalkable;
};

export const resolveLootLocation = (scene, x, y) => {
  const origin = { x: Math.round(x), y: Math.round(y) };
  if (isSafeLootTile(scene, origin.x, origin.y)) {
    return origin;
  }

  for (let radius = 1; radius <= 6; radius += 1) {
    for (let offset = -radius; offset <= radius; offset += 1) {
      const candidates = [
        { x: origin.x + offset, y: origin.y - radius },
        { x: origin.x + radius, y: origin.y + offset },
        { x: origin.x - offset, y: origin.y + radius },
        { x: origin.x - radius, y: origin.y - offset },
      ];
      const safe = candidates.find(candidate => isSafeLootTile(scene, candidate.x, candidate.y));
      if (safe) {
        return safe;
      }
    }
  }

  const spawnFallback = scene?.metadata?.spawnPoints?.find(point => (
    isSafeLootTile(scene, point.x, point.y)
  ));
  if (spawnFallback) {
    return { x: spawnFallback.x, y: spawnFallback.y };
  }

  const width = config.map.size.x;
  const height = config.map.size.y;
  for (let index = 0; index < width * height; index += 1) {
    const candidate = { x: index % width, y: Math.floor(index / width) };
    if (isSafeLootTile(scene, candidate.x, candidate.y)) {
      return candidate;
    }
  }

  return origin;
};

/**
 * Drop a slain monster's rewards onto its tile: its coin bounty always,
 * plus a rarity-gated chance of a piece of gear. Drops land in the
 * monster's scene and are broadcast to the players inside it.
 *
 * @param {object} monster The monster that died
 * @param {object} options Optional rng override for tests
 * @returns {array} The world item instances dropped
 */
export const dropMonsterLoot = (monster, options = {}) => {
  if (!monster || !Number.isFinite(monster.x) || !Number.isFinite(monster.y)) {
    return [];
  }

  const scene = world.getScene(monster.sceneId);
  if (!scene) {
    return [];
  }

  // Monsters roam at continuous positions and can die beside a wall or on a
  // staircase. Snap rewards to a nearby walkable, non-transition tile so a
  // Take action can never strand loot or zone the player instead.
  const dropLocation = resolveLootLocation(scene, monster.x, monster.y);
  const dropX = dropLocation.x;
  const dropY = dropLocation.y;

  const rng = typeof options.rng === 'function' ? options.rng : Math.random;
  const drops = [];

  const coins = monster.rewards && Number.isFinite(monster.rewards.coins)
    ? Math.max(0, Math.floor(monster.rewards.coins))
    : 0;
  if (coins > 0) {
    const coinItem = ItemFactory.createById('coins', { quantity: coins });
    if (coinItem) {
      drops.push(ItemFactory.toWorldInstance(coinItem, { x: dropX, y: dropY }));
    }
  }

  const rarityId = monster.rarityId || 'common';
  const gearChance = GEAR_DROP_CHANCES[rarityId] !== undefined
    ? GEAR_DROP_CHANCES[rarityId]
    : GEAR_DROP_CHANCES.common;
  if (rng() < gearChance) {
    const gearId = GEAR_DROP_POOL[Math.floor(rng() * GEAR_DROP_POOL.length)];
    const monsterLevel = Number.isFinite(monster.level)
      ? monster.level
      : monster.stats && Number.isFinite(monster.stats.level) ? monster.stats.level : undefined;
    const gear = ItemFactory.createById(gearId, {
      rng,
      itemLevel: monsterLevel ? Math.min(80, monsterLevel * 2) : undefined,
    });
    if (gear) {
      drops.push(ItemFactory.toWorldInstance(gear, { x: dropX, y: dropY }));
    }
  }

  const relicChance = Number.isFinite(options.relicChance)
    ? Math.max(0, Math.min(1, options.relicChance))
    : RELIC_DROP_CHANCE;
  if (rng() < relicChance) {
    const eligiblePlayers = [options.killer, ...world.getScenePlayers(scene.id)].filter(Boolean);
    const relic = typeof options.relicProvider === 'function'
      ? options.relicProvider(eligiblePlayers)
      : drawCirculatingRelic(eligiblePlayers);
    if (relic) {
      drops.push(ItemFactory.toWorldInstance(relic, { x: dropX, y: dropY }));
    }
  }

  if (drops.length) {
    if (!Array.isArray(scene.items)) {
      scene.items = [];
    }
    scene.items.push(...drops);
    if (options.killer) autoPickupCurrency(options.killer);
    Socket.broadcast('world:itemDropped', scene.items, world.getScenePlayers(scene.id));
  }

  return drops;
};

export default {
  dropMonsterLoot,
  GEAR_DROP_CHANCES,
  GEAR_DROP_POOL,
  RELIC_DROP_CHANCE,
};
