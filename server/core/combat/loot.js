import ItemFactory from '#server/core/items/factory.js';
import Socket from '#server/socket.js';
import world from '#server/core/world.js';
import chroniclesStore from '#server/core/services/chronicles-store.js';
import { drawCirculatingRelic } from '#server/core/services/chronicles.js';
import {
  isActiveQuest,
  isCurrentQuestObjective,
} from '#server/core/services/quest-service.js';

// Chance a slain monster drops a piece of gear, by rarity tier
// House-relic circulation (SQLite Chronicles): chance per kill that a fallen
// scion's heirloom re-enters the world near an eligible House member.
export const RELIC_DROP_CHANCE = 0.12;

export const GEAR_DROP_CHANCES = {
  common: 0.05,
  uncommon: 0.1,
  rare: 0.2,
  elite: 0.5,
};

// Vesselforge-native catalogue entries declare one exact form. Their material,
// name, footprint and combat profile are rolled together, avoiding the old
// split identity where (for example) a Bronze Sword advertised itself as a
// Flint Handaxe.
export const GEAR_DROP_POOL = [
  'vessel-handaxe',
  'vessel-spear',
  'vessel-macuahuitl',
  'vessel-atlatl',
  'vessel-khopesh',
  'vessel-sling',
  'vessel-shield',
  'vessel-wrap',
  'vessel-crest',
  'vessel-grips',
  'vessel-sandals',
  'vessel-gorget',
  'vessel-ring',
];

const goodsFoundPercent = player => Math.max(
  0,
  Math.min(100, Number(player?.combat?.goodsFound) || 0),
);

export const applyGoodsFoundToCoins = (coins, player) => Math.max(
  0,
  Math.floor(Math.max(0, Number(coins) || 0) * (1 + (goodsFoundPercent(player) / 100))),
);

export const applyGoodsFoundToGearChance = (chance, player) => Math.min(
  0.75,
  Math.max(0, Number(chance) || 0) * (1 + (goodsFoundPercent(player) / 100)),
);

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

  const baseCoins = monster.rewards && Number.isFinite(monster.rewards.coins)
    ? Math.max(0, Math.floor(monster.rewards.coins))
    : 0;
  const player = options.player || options.killer;
  const coins = applyGoodsFoundToCoins(baseCoins, player);
  if (coins > 0) {
    const coinItem = ItemFactory.createById('coins', { quantity: coins });
    if (coinItem) {
      drops.push(ItemFactory.toWorldInstance(coinItem, { x: dropX, y: dropY }));
    }
  }

  const rarityId = monster.rarityId || 'common';
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

  // SQLite Chronicles circulation: fallen scions of Houses present in the
  // scene can surface their heirlooms on any kill (dev:release-relic forces
  // this with relicChance: 1).
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

  const baseGearChance = GEAR_DROP_CHANCES[rarityId] !== undefined
    ? GEAR_DROP_CHANCES[rarityId]
    : GEAR_DROP_CHANCES.common;
  const gearChance = applyGoodsFoundToGearChance(baseGearChance, player);
  // Proof of Temper must remain completable without farming a 50% elite roll.
  // The guardian still chooses a random native form; only the first drop is
  // guaranteed while that exact objective is current.
  const guaranteesQuestVessel = rarityId === 'elite'
    && isActiveQuest(player, 'proof-of-temper')
    && isCurrentQuestObjective(player, 'slay-elite');
  if (guaranteesQuestVessel || rng() < gearChance) {
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
  applyGoodsFoundToCoins,
  applyGoodsFoundToGearChance,
};
