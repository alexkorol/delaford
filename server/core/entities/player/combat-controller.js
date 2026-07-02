import {
  DEFAULT_ANIMATION_DURATIONS,
  DEFAULT_ANIMATION_HOLDS,
  DEFAULT_FACING_DIRECTION,
  GLOBAL_COOLDOWN_MS,
} from '#shared/combat.js';

const resolveFacing = (movement, fallbackFacing, direction) => {
  const resolved = movement.resolveFacing(direction);
  if (!resolved) {
    return fallbackFacing || DEFAULT_FACING_DIRECTION;
  }
  return resolved;
};

const recordSkillInput = (player, movement, skillId, data = {}) => {
  if (!skillId) {
    return false;
  }

  const nowTs = Number.isFinite(data.now) ? data.now : Date.now();
  if (player.combat.globalCooldown && player.combat.globalCooldown > nowTs) {
    return false;
  }

  const facing = resolveFacing(movement, player.facing, data.direction);
  movement.setFacing(facing);

  const currentSequence = Number.isFinite(player.combat.sequence) ? player.combat.sequence : 0;
  player.combat.sequence = currentSequence + 1;
  player.combat.globalCooldown = nowTs + GLOBAL_COOLDOWN_MS;
  player.combat.lastSkill = {
    id: skillId,
    usedAt: nowTs,
    direction: facing,
    modifiers: data.modifiers || {},
    sequence: player.combat.sequence,
  };

  const windowStart = nowTs - 3000;
  const history = Array.isArray(player.combat.inputHistory) ? player.combat.inputHistory : [];
  player.combat.inputHistory = [
    ...history.filter((entry) => entry && entry.usedAt && entry.usedAt >= windowStart),
    player.combat.lastSkill,
  ];

  const animationState = data.animationState || 'attack';
  const duration = data.duration !== undefined
    ? data.duration
    : (DEFAULT_ANIMATION_DURATIONS[animationState] || DEFAULT_ANIMATION_DURATIONS.attack);
  const holdState = data.holdState !== undefined
    ? data.holdState
    : (DEFAULT_ANIMATION_HOLDS[animationState] || DEFAULT_ANIMATION_HOLDS.attack);

  movement.setAnimationState(animationState, {
    direction: facing,
    duration,
    skillId,
    holdState,
    startedAt: nowTs,
  });

  return true;
};

const createPlayerCombatController = (player, movement) => ({
  recordSkillInput: (skillId, data) => recordSkillInput(player, movement, skillId, data),
});

export default createPlayerCombatController;
