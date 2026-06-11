import Socket from '#server/socket.js';
import UI from '#shared/ui.js';
import { broadcastStats } from '#server/core/entities/player/stats-manager.js';

const COMBAT_SKILL_IDS = ['attack', 'defence'];

export const sendMessage = (player, text) => {
  if (!player || !player.socket_id) {
    return;
  }

  Socket.emit('game:send:message', {
    player: { socket_id: player.socket_id },
    text,
  });
};

/**
 * Total experience across combat skills; drives the character level.
 *
 * @param {object} player The player whose combat experience to total
 * @returns {integer}
 */
export const getCombatExperienceTotal = (player) => {
  if (!player || !player.skills) {
    return 0;
  }

  return COMBAT_SKILL_IDS.reduce((total, skillId) => {
    const skill = player.skills[skillId];
    return total + (skill && Number.isFinite(skill.exp) ? skill.exp : 0);
  }, 0);
};

/**
 * Recompute the character level from combat experience. Levels only
 * increase; on level-up derived resources are refreshed and refilled.
 *
 * @param {object} player The player to evaluate
 * @returns {boolean} Whether the player levelled up
 */
export const recomputeCharacterLevel = (player) => {
  if (!player) {
    return false;
  }

  const derived = UI.getLevel(getCombatExperienceTotal(player));
  const current = Number.isFinite(player.level) ? player.level : 1;

  if (derived <= current) {
    return false;
  }

  player.level = derived;
  player.refreshDerivedStats();

  // A level-up restores the character to full
  player.stats.resources.health.current = player.stats.resources.health.max;
  player.stats.resources.mana.current = player.stats.resources.mana.max;
  player.hp = player.stats.resources.health;
  player.mana = player.stats.resources.mana;

  sendMessage(player, `You are now level ${derived}!`);
  broadcastStats(player);
  return true;
};

/**
 * Add experience to one of the player's skills, handling level-ups,
 * client refresh and character-level progression.
 *
 * @param {object} player The player earning experience
 * @param {string} skillId The skill receiving the experience
 * @param {integer} amount The experience to add
 * @returns {object|null} Summary of the award
 */
export const awardSkillExperience = (player, skillId, amount) => {
  const experience = Math.max(0, Math.floor(amount));
  if (!player || !player.skills || !player.skills[skillId] || experience <= 0) {
    return null;
  }

  const skill = player.skills[skillId];
  const previousLevel = Number.isFinite(skill.level) ? skill.level : UI.getLevel(skill.exp);

  skill.exp += experience;
  skill.level = UI.getLevel(skill.exp);

  const levelledUp = skill.level > previousLevel;
  if (levelledUp) {
    sendMessage(player, `You have gained a ${UI.capitalizeFirstLetter(skillId)} level!`);
  }

  Socket.emit('resource:skills:update', {
    player: { socket_id: player.socket_id },
    data: player.skills,
  });

  const characterLevelledUp = recomputeCharacterLevel(player);

  return {
    skillId,
    amount: experience,
    level: skill.level,
    levelledUp,
    characterLevelledUp,
  };
};

export default {
  awardSkillExperience,
  getCombatExperienceTotal,
  recomputeCharacterLevel,
  sendMessage,
};
