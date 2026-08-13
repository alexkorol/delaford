import ItemFactory from '#server/core/items/factory.js';
import Socket from '#server/socket.js';
import world from '#server/core/world.js';
import chroniclesStore from '#server/core/services/chronicles-store.js';

// Chance a slain monster drops a piece of gear, by rarity tier
export const GEAR_DROP_CHANCES = {
  common: 0.05,
  uncommon: 0.1,
  rare: 0.2,
  elite: 0.5,
};

// A spread across weapon types, every armour slot, and jewelry so drops feel
// varied rather than the same handful of swords.
export const GEAR_DROP_POOL = [
  // weapons — different families
  'bronze-sword',
  'bronze-dagger',
  'bronze-mace',
  'bronze-battleaxe',
  'bronze-spear',
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
  // jewelry
  'ring',
  'gold-ring',
  'garnet-amulet',
];

/**
 * Drop a slain monster's rewards onto its tile: its coin bounty always,
 * plus a rarity-gated chance of a piece of gear. Drops land in the
 * monster's scene and are broadcast to the players inside it.
 *
 * @param {object} monster The monster that died
 * @param {object} options Optional killer and rng override for tests
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

  // Monsters roam at continuous positions; loot must land on the tile grid
  // so pickup (exact tile match) and rendering line up.
  const dropX = Math.round(monster.x);
  const dropY = Math.round(monster.y);

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
  const player = options.player;
  if (rarityId === 'elite' && player && player.uuid && player.chronicles) {
    const released = chroniclesStore.beginRelicDrop(player.uuid, player.chronicles);
    if (released.ok && released.relic && released.relic.item) {
      const heirloom = ItemFactory.adoptExisting(released.relic.item);
      if (heirloom) {
        drops.push(ItemFactory.toWorldInstance(heirloom, { x: dropX, y: dropY }));
        Socket.emit('game:send:message', {
          player: { socket_id: player.socket_id },
          text: `${released.fallen.name}'s heirloom has returned to the world.`,
        });
      }
    }
  }

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
