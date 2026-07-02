import ItemFactory from '#server/core/items/factory.js';
import Socket from '#server/socket.js';
import world from '#server/core/world.js';

// Chance a slain monster drops a piece of gear, by rarity tier
export const GEAR_DROP_CHANCES = {
  common: 0.05,
  uncommon: 0.1,
  rare: 0.2,
  elite: 0.5,
};

export const GEAR_DROP_POOL = [
  'bronze-sword',
  'bronze-dagger',
  'bronze-mace',
  'bronze-helm',
  'wooden-shield',
  'leather-body',
  'leather-boots',
  'iron-dagger',
  'shortbow',
];

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

  const rng = typeof options.rng === 'function' ? options.rng : Math.random;
  const drops = [];

  const coins = monster.rewards && Number.isFinite(monster.rewards.coins)
    ? Math.max(0, Math.floor(monster.rewards.coins))
    : 0;
  if (coins > 0) {
    const coinItem = ItemFactory.createById('coins', { quantity: coins });
    if (coinItem) {
      drops.push(ItemFactory.toWorldInstance(coinItem, { x: monster.x, y: monster.y }));
    }
  }

  const rarityId = monster.rarityId || 'common';
  const gearChance = GEAR_DROP_CHANCES[rarityId] !== undefined
    ? GEAR_DROP_CHANCES[rarityId]
    : GEAR_DROP_CHANCES.common;
  if (rng() < gearChance) {
    const gearId = GEAR_DROP_POOL[Math.floor(rng() * GEAR_DROP_POOL.length)];
    const gear = ItemFactory.createById(gearId, { rng });
    if (gear) {
      drops.push(ItemFactory.toWorldInstance(gear, { x: monster.x, y: monster.y }));
    }
  }

  if (drops.length) {
    if (!Array.isArray(scene.items)) {
      scene.items = [];
    }
    scene.items.push(...drops);
    Socket.broadcast('world:itemDropped', scene.items, world.getScenePlayers(scene.id));
  }

  return drops;
};

export default {
  dropMonsterLoot,
  GEAR_DROP_CHANCES,
  GEAR_DROP_POOL,
};
