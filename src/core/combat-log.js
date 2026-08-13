import { getSkillDefinition } from '@shared/skills/index.js';

const titleCase = value => String(value || '')
  .replace(/[-_]+/g, ' ')
  .split(' ')
  .filter(Boolean)
  .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
  .join(' ');

export const formatCombatSkillName = (payload = {}) => {
  if (payload.skillName) {
    return payload.skillName;
  }

  if (!payload.skillId || payload.skillId === 'monster:attack') {
    return '';
  }

  const skill = getSkillDefinition(payload.skillId);
  return skill ? skill.label || skill.name || payload.skillId : titleCase(payload.skillId);
};

export const formatCombatExperience = (experience = null) => {
  if (!experience || !Number.isFinite(experience.amount) || experience.amount <= 0) {
    return '';
  }

  const skillName = experience.skillId ? titleCase(experience.skillId) : '';
  const xpLabel = skillName ? `${skillName} XP` : 'XP';
  const levelText = experience.levelledUp && experience.level
    ? ` ${skillName || 'Skill'} level ${experience.level}.`
    : '';

  return ` +${experience.amount} ${xpLabel}.${levelText}`;
};

export const formatCombatLogText = ({
  attacker = 'Unknown',
  target = 'Unknown',
  payload = {},
} = {}) => {
  const amount = Number.isFinite(payload.amount) ? payload.amount : 0;
  const skillName = formatCombatSkillName(payload);
  const skill = skillName ? ` with ${skillName}` : '';

  if (payload.blocked) {
    if (target === 'You') {
      return `You blocked ${attacker}'s attack.`;
    }
    return `${target} blocked ${attacker}'s attack.`;
  }

  let text = `${attacker} hit ${target}${skill} for ${amount}.`;
  if (attacker === 'You') {
    text = `You hit ${target}${skill} for ${amount}.`;
  } else if (target === 'You') {
    text = `${attacker} hit you for ${amount}.`;
  }

  if (payload.died) {
    text += target === 'You'
      ? ' You died.'
      : ` ${target} died.${formatCombatExperience(payload.experience)}`;
  }

  return text;
};

export const buildCombatLogEntry = (payload = {}, actors = {}) => ({
  type: 'combat',
  text: formatCombatLogText({
    attacker: actors.attacker,
    target: actors.target,
    payload,
  }),
  color: payload.targetType === 'player' ? '#ff8a80' : '#ffd166',
});

export default {
  buildCombatLogEntry,
  formatCombatExperience,
  formatCombatLogText,
  formatCombatSkillName,
};
