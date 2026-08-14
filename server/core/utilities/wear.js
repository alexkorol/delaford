import world from '#server/core/world.js';
import { wearableItems } from '../data/items/index.js';

class Wear {
  /**
   * Get the attack value from this item
   *
   * @param {object} item The item being assessed
   * @returns {integer}
   */
  static getAttack(item) {
    if (item && item.stats && item.stats.attack) {
      return item.stats.attack;
    }

    const fullItem = wearableItems.find(i => i.id === item.id);
    return fullItem && fullItem.stats ? fullItem.stats.attack : {
      stab: 0,
      slash: 0,
      crush: 0,
      range: 0,
    };
  }

  /**
   * Get the defense value from this item
   *
   * @param {object} item The item being assessed
   * @returns {integer}
   */
  static getDefense(item) {
    if (item && item.stats && item.stats.defense) {
      return item.stats.defense;
    }

    const fullItem = wearableItems.find(i => i.id === item.id);
    return fullItem && fullItem.stats ? fullItem.stats.defense : {
      stab: 0,
      slash: 0,
      crush: 0,
      range: 0,
    };
  }

  static getCombatBonuses(item) {
    if (!item || typeof item !== 'object') {
      return {};
    }
    return item.combatBonuses || item.vessel?.combat?.modifiers || {};
  }

  /**
   * Rebuild combat totals from authoritative worn-item state. Accepting a
   * player object lets the Player constructor restore persisted equipment
   * before the actor has been inserted into world.players.
   */
  static updateCombat(playerOrIndex) {
    const player = Number.isInteger(playerOrIndex)
      ? world.players[playerOrIndex]
      : playerOrIndex;
    return this.calculateCombat(player && player.wear);
  }

  static calculateCombat(wear = {}) {
    const stats = {
      attack: {
        stab: 0,
        slash: 0,
        crush: 0,
        range: 0,
      },
      defense: {
        stab: 0,
        slash: 0,
        crush: 0,
        range: 0,
      },
      blockChance: 0,
      criticalChance: 0,
      goodsFound: 0,
      damageAgainstBeasts: 0,
    };

    if (!wear || typeof wear !== 'object') {
      return stats;
    }

    // Go through each wear item and add up its value
    Object.keys(wear).forEach((key) => {
      const val = wear[key];
      if (val !== null && val.uuid && val.id) {
        const attack = this.getAttack(val);
        const defense = this.getDefense(val);
        const combatBonuses = this.getCombatBonuses(val);

        stats.attack.stab += attack.stab || 0;
        stats.attack.slash += attack.slash || 0;
        stats.attack.crush += attack.crush || 0;
        stats.attack.range += attack.range || 0;

        stats.defense.stab += defense.stab || 0;
        stats.defense.slash += defense.slash || 0;
        stats.defense.crush += defense.crush || 0;
        stats.defense.range += defense.range || 0;
        stats.blockChance += Number(combatBonuses.blockChance) || 0;
        stats.criticalChance += Number(combatBonuses.criticalChance) || 0;
        stats.goodsFound += Number(combatBonuses.goodsFound) || 0;
        stats.damageAgainstBeasts += Number(combatBonuses.damageAgainstBeasts) || 0;
      }
    });

    stats.blockChance = Math.max(0, Math.min(75, stats.blockChance));
    stats.criticalChance = Math.max(0, Math.min(75, stats.criticalChance));
    stats.goodsFound = Math.max(0, Math.min(100, stats.goodsFound));
    stats.damageAgainstBeasts = Math.max(0, Math.min(100, stats.damageAgainstBeasts));

    return stats;
  }
}

export default Wear;
