import world from '#server/core/world.js';
import { broadcastStats } from '#server/core/entities/player/stats-manager.js';

export const REGEN_INTERVAL_MS = 2000;
export const HEALTH_REGEN_COMBAT_DELAY_MS = 8000;
export const HEALTH_REGEN_FRACTION = 0.02;
export const MANA_REGEN_FRACTION = 0.03;

const regenAmount = (max, fraction) => Math.max(1, Math.floor(max * fraction));

const canRegenerate = (player) => {
  const stats = player && player.stats;
  const resources = stats && stats.resources;
  if (!resources || !resources.health || !resources.mana) {
    return false;
  }
  if (resources.health.current <= 0) {
    return false;
  }
  const lifecycleState = stats.lifecycle && stats.lifecycle.state;
  return !lifecycleState || lifecycleState === 'alive' || lifecycleState === 'cheat-death';
};

/**
 * Tick passive recovery for every connected player: mana trickles back
 * constantly, health only once the player has been out of combat for
 * HEALTH_REGEN_COMBAT_DELAY_MS. Combat participation is stamped on
 * player.combat.lastCombatAt by the damage paths.
 *
 * @param {number} now Timestamp for this tick
 * @returns {object} Summary of processed and updated players
 */
export const processResourceRegeneration = (now = Date.now()) => {
  const players = Array.isArray(world.players) ? world.players : [];
  const summary = { processed: 0, updated: 0 };

  players.forEach((player) => {
    if (!canRegenerate(player)) {
      return;
    }

    summary.processed += 1;
    const { health, mana } = player.stats.resources;
    let changed = false;

    if (mana.current < mana.max) {
      mana.current = Math.min(mana.max, mana.current + regenAmount(mana.max, MANA_REGEN_FRACTION));
      changed = true;
    }

    const lastCombatAt = (player.combat && player.combat.lastCombatAt) || 0;
    const inCombat = now - lastCombatAt < HEALTH_REGEN_COMBAT_DELAY_MS;
    if (!inCombat && health.current < health.max) {
      health.current = Math.min(health.max, health.current + regenAmount(health.max, HEALTH_REGEN_FRACTION));
      changed = true;
    }

    // A player rescued by cheat death recovers to 'alive' once regeneration
    // brings them back above zero — mirror applyHealing so the lifecycle state
    // does not stay stuck at 'cheat-death' forever.
    const lifecycle = player.stats.lifecycle;
    if (lifecycle && lifecycle.state === 'cheat-death' && health.current > 0) {
      lifecycle.state = 'alive';
      changed = true;
    }

    if (changed) {
      player.hp = health;
      player.mana = mana;
      broadcastStats(player);
      summary.updated += 1;
    }
  });

  return summary;
};

export default {
  processResourceRegeneration,
  REGEN_INTERVAL_MS,
  HEALTH_REGEN_COMBAT_DELAY_MS,
  HEALTH_REGEN_FRACTION,
  MANA_REGEN_FRACTION,
};
