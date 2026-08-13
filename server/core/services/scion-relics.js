import { buildDurableItemSnapshot } from '#server/core/repositories/guest-save-store.js';
import Wear from '#server/core/utilities/wear.js';

const EQUIPMENT_PRIORITY = [
  'right_hand',
  'left_hand',
  'armor',
  'head',
  'necklace',
  'ring',
  'back',
  'gloves',
  'feet',
];

const isRelicEligible = item => Boolean(
  item
  && item.id
  && item.uuid
  && item.stackable !== true
  && ['weapon', 'armor', 'jewelry'].includes(item.type),
);

const refreshEquipment = (player) => {
  if (!player) {
    return;
  }
  const combat = Wear.calculateCombat(player.wear);
  player.combat = {
    ...(player.combat || {}),
    attack: combat.attack,
    defense: combat.defense,
    blockChance: combat.blockChance,
    criticalChance: combat.criticalChance,
    goodsFound: combat.goodsFound,
  };
  if (typeof player.refreshDerivedStats === 'function') {
    player.refreshDerivedStats();
  }
};

/**
 * Choose the heirloom a mortal Scion will leave behind. Equipped gear wins
 * over backpack gear, with the main-hand weapon first so the choice is stable
 * and legible rather than dependent on object insertion order.
 */
export const selectScionRelic = (player) => {
  if (!player) {
    return null;
  }

  for (const slot of EQUIPMENT_PRIORITY) {
    const item = player.wear && player.wear[slot];
    if (isRelicEligible(item)) {
      return {
        item: buildDurableItemSnapshot(item),
        location: { type: 'wear', slot },
      };
    }
  }

  const inventory = player.inventory && Array.isArray(player.inventory.slots)
    ? player.inventory.slots
    : [];
  const item = inventory.find(isRelicEligible);
  return item ? {
    item: buildDurableItemSnapshot(item),
    location: { type: 'inventory' },
  } : null;
};

/** Remove every copy of an exact item UUID from inherited character state. */
export const removeItemIdentity = (player, itemUuid) => {
  if (!player || !itemUuid) {
    return false;
  }

  let removed = false;
  Object.keys(player.wear || {}).forEach((slot) => {
    if (player.wear[slot] && player.wear[slot].uuid === itemUuid) {
      player.wear[slot] = null;
      removed = true;
    }
  });

  if (player.inventory && Array.isArray(player.inventory.slots)) {
    const before = player.inventory.slots.length;
    player.inventory.slots = player.inventory.slots.filter(item => item.uuid !== itemUuid);
    removed = removed || player.inventory.slots.length !== before;
  }

  if (removed) {
    refreshEquipment(player);
  }
  return removed;
};

export const unrecoveredRelicUuids = (chroniclesState) => {
  const uuids = new Set();
  (chroniclesState && Array.isArray(chroniclesState.houses) ? chroniclesState.houses : [])
    .forEach((house) => {
      (Array.isArray(house.crypt) ? house.crypt : []).forEach((scion) => {
        const relic = scion && scion.relic;
        if (relic && relic.status !== 'recovered' && relic.item && relic.item.uuid) {
          uuids.add(relic.item.uuid);
        }
      });
    });
  return uuids;
};

/**
 * Reconcile an interrupted death handoff before a successor enters the world.
 * If the Chronicle owns an unrecovered relic, an older character snapshot may
 * not also keep a copy of that UUID.
 */
export const pruneUnrecoveredRelics = (player, chroniclesState) => {
  let removed = 0;
  unrecoveredRelicUuids(chroniclesState).forEach((itemUuid) => {
    if (removeItemIdentity(player, itemUuid)) {
      removed += 1;
    }
  });
  return removed;
};

export default {
  selectScionRelic,
  removeItemIdentity,
  unrecoveredRelicUuids,
  pruneUnrecoveredRelics,
};
