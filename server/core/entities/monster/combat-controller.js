import Socket from '#server/socket.js';
import world from '#server/core/world.js';
import { DEFAULT_FACING_DIRECTION, DEFAULT_SKILL_IDS } from '#shared/combat.js';
import { DEFAULT_BEHAVIOUR } from '#server/core/entities/monster/stats-manager.js';
import { euclideanDistance, manhattanDistance, resolveDirection } from '#server/core/entities/monster/movement-handler.js';
import UI from '#shared/ui.js';
import { entombFallenScion } from '#server/core/services/chronicles.js';

// Continuous positions: melee pursuit stands off ~1 tile from the target
// (never on its tile), so reach checks are radii with diagonal headroom.
const REACH_TOLERANCE = 0.6;

const rollDamage = (monster) => {
  const archetype = monster.archetype || {};
  const rarity = monster.rarity || {};
  const totals = monster.stats && monster.stats.attributes ? monster.stats.attributes.total : {};

  let min = archetype.damage && Number.isFinite(archetype.damage.baseMin)
    ? archetype.damage.baseMin
    : 1;
  let max = archetype.damage && Number.isFinite(archetype.damage.baseMax)
    ? archetype.damage.baseMax
    : min + 2;

  if (archetype.damage && Number.isFinite(archetype.damage.scalingPerStrength)) {
    const strength = totals.strength || 0;
    min += strength * (archetype.damage.scalingPerStrength * 0.5);
    max += strength * archetype.damage.scalingPerStrength;
  }

  if (archetype.damage && Number.isFinite(archetype.damage.scalingPerDexterity)) {
    const dexterity = totals.dexterity || 0;
    min += dexterity * (archetype.damage.scalingPerDexterity * 0.35);
    max += dexterity * archetype.damage.scalingPerDexterity;
  }

  if (archetype.damage && Number.isFinite(archetype.damage.scalingPerIntelligence)) {
    const intelligence = totals.intelligence || 0;
    min += intelligence * (archetype.damage.scalingPerIntelligence * 0.4);
    max += intelligence * archetype.damage.scalingPerIntelligence;
  }

  const damageMultiplier = (monster.behaviour && monster.behaviour.attack && monster.behaviour.attack.damageMultiplier)
    ? monster.behaviour.attack.damageMultiplier
    : 1;
  const rarityMultiplier = rarity.damageMultiplier || 1;
  // Optional per-monster damage scale (instance trash hits softer than bosses).
  const monsterMultiplier = Number.isFinite(monster.damageMultiplier) ? monster.damageMultiplier : 1;
  const now = Date.now();
  const effectMultiplier = Object.entries(monster.state?.effects || {}).reduce((total, [id, effect]) => {
    if (!effect || !Number.isFinite(effect.expiresAt) || effect.expiresAt <= now) {
      delete monster.state.effects[id];
      return total;
    }
    return total * (Number.isFinite(effect.damageMultiplier) ? effect.damageMultiplier : 1);
  }, 1);

  min *= damageMultiplier * rarityMultiplier * monsterMultiplier * effectMultiplier;
  max *= damageMultiplier * rarityMultiplier * monsterMultiplier * effectMultiplier;

  const rolled = UI.getRandomInt(Math.max(1, Math.floor(min)), Math.max(1, Math.ceil(max)));
  return Math.max(1, rolled);
};

const resolveTarget = (monster, now = Date.now()) => {
  const scenePlayers = world.getScenePlayers(monster.sceneId);
  if (!scenePlayers.length) {
    monster.state.targetId = null;
    return null;
  }

  const aggressionRange = monster.behaviour.aggressionRange || DEFAULT_BEHAVIOUR.aggressionRange;
  const pursuitRange = monster.behaviour.pursuitRange || aggressionRange + 2;

  const currentTarget = monster.state.targetId
    ? scenePlayers.find(player => player && player.uuid === monster.state.targetId)
    : null;

  if (currentTarget && currentTarget.stats && currentTarget.stats.resources.health.current > 0) {
    const distance = manhattanDistance(monster, currentTarget);
    if (distance <= pursuitRange) {
      return currentTarget;
    }
  }

  const viable = scenePlayers
    .filter((player) => {
      if (!player || !player.stats || !player.stats.resources) {
        return false;
      }
      if (player.stats.resources.health.current <= 0) {
        return false;
      }
      const distance = manhattanDistance(monster, player);
      return distance <= aggressionRange;
    })
    .sort((a, b) => manhattanDistance(monster, a) - manhattanDistance(monster, b));

  const nextTarget = viable[0] || null;

  monster.state.targetId = nextTarget ? nextTarget.uuid : null;
  if (!nextTarget) {
    monster.state.mode = 'idle';
    monster.state.pendingAttack = null;
  }
  return nextTarget;
};

const tryAttack = (monster, target, now = Date.now()) => {
  if (!target || !monster.isAlive) {
    return false;
  }

  const attack = monster.behaviour.attack || DEFAULT_BEHAVIOUR.attack;
  const sinceLastAttack = now - (monster.state.lastAttackAt || 0);

  if (monster.state.pendingAttack && now >= monster.state.pendingAttack.resolveAt) {
    monster.combatController.resolvePendingAttack(now);
  }

  if (monster.state.pendingAttack) {
    return false;
  }

  if (sinceLastAttack < attack.intervalMs) {
    return false;
  }

  const skillId = attack.skillId || 'monster:attack';
  const isGroundSlam = skillId === 'boss:ground-slam';
  const range = Math.max(1, attack.range || 1);
  const distance = euclideanDistance(monster, target);
  if (distance > range + (isGroundSlam ? 0 : REACH_TOLERANCE)) {
    return false;
  }

  const direction = resolveDirection(monster, target) || monster.facing || DEFAULT_FACING_DIRECTION;
  monster.setFacing(direction);

  const damage = rollDamage(monster);
  const resolveAt = now + attack.windupMs;

  monster.setAnimationState('attack', {
    direction,
    duration: attack.windupMs,
    startedAt: now,
    holdState: 'idle',
    skillId,
  });

  monster.state.pendingAttack = {
    targetId: target.uuid,
    resolveAt,
    damage,
    skillId,
    skillName: attack.skillName || 'Attack',
    originX: monster.x,
    originY: monster.y,
    radius: isGroundSlam ? Math.max(1, Number(attack.radius) || 2) : null,
  };

  if (isGroundSlam) {
    Socket.broadcast('monster:telegraph', {
      attackerId: monster.uuid,
      attackerName: monster.name,
      skillId,
      skillName: attack.skillName || 'Ground Slam',
      x: monster.x,
      y: monster.y,
      radius: monster.state.pendingAttack.radius,
      durationMs: attack.windupMs,
      startedAt: now,
    }, world.getScenePlayers(monster.sceneId));
  }

  monster.state.lastAttackAt = now;

  // Ranged attacks fly as a visible projectile during the windup — the hit
  // used to land "from nowhere" (playtest: "invisible projectiles").
  if (range > 1) {
    Socket.broadcast('world:projectile', {
      fromX: monster.x,
      fromY: monster.y,
      toX: target.x,
      toY: target.y,
      travelMs: Math.max(120, attack.windupMs || 300),
      kind: monster.behaviour.type === 'support' ? 'support' : 'monster',
    }, world.getScenePlayers(monster.sceneId));
  }

  return true;
};

const consumeExpiredPlayerBuffs = (target, now) => {
  const buffs = target && target.combat && target.combat.buffs;
  if (!buffs || typeof buffs !== 'object') {
    return [];
  }

  return Object.entries(buffs).reduce((active, [id, buff]) => {
    if (!buff || !Number.isFinite(buff.expiresAt) || buff.expiresAt <= now) {
      delete buffs[id];
      return active;
    }
    active.push(buff);
    return active;
  }, []);
};

const getArmourMitigation = (target, now) => (
  consumeExpiredPlayerBuffs(target, now)
    .reduce((total, buff) => total + Math.max(0, Math.floor(buff.armourBonus || 0)), 0)
);

const resolvePendingAttack = (monster, now = Date.now()) => {
  const payload = monster.state.pendingAttack;
  if (!payload) {
    return false;
  }

  const scenePlayers = world.getScenePlayers(monster.sceneId);
  const target = scenePlayers.find(player => player.uuid === payload.targetId);
  monster.state.pendingAttack = null;

  if (!target) {
    return false;
  }

  const attack = monster.behaviour.attack || DEFAULT_BEHAVIOUR.attack;
  const isGroundSlam = payload.skillId === 'boss:ground-slam';
  const range = isGroundSlam ? payload.radius : Math.max(1, attack.range || 1);
  const source = isGroundSlam
    ? { x: payload.originX, y: payload.originY }
    : monster;
  const distance = euclideanDistance(source, target);
  if (distance > range + (isGroundSlam ? 0 : REACH_TOLERANCE)) {
    return false;
  }

  const nowTs = now;
  const mitigation = getArmourMitigation(target, nowTs);
  const damage = Math.max(0, Math.floor(payload.damage - mitigation));
  target.combat = target.combat || {};
  target.combat.lastCombatAt = nowTs;
  const result = target.applyDamage(damage, { allowCheatDeath: true, now: nowTs });

  if (result) {
    target.setAnimationState('hurt', { direction: target.facing, startedAt: nowTs });
    // Stats broadcast handled by player logic

    // Auto-retaliate: a struck, unengaged player fights back at their
    // attacker (even unarmed) instead of standing there taking hits. The
    // auto-attack tick (processAutoAttacks) does range/alive gating.
    const struckAlive = result.type !== 'death' && result.type !== 'permadeath';
    if (struckAlive && target.combat && !target.combat.autoAttack) {
      target.combat.autoAttack = {
        targetId: monster.uuid,
        targetName: monster.name || 'Monster',
        sceneId: target.sceneId,
        skillId: DEFAULT_SKILL_IDS.primary,
        startedAt: nowTs,
        lastTriggeredAt: 0,
      };
      target.combat.autoAttackStoppedReason = null;
    }

    if (result.type === 'death' || result.type === 'permadeath') {
      monster.state.mode = 'idle';
      monster.state.targetId = null;

      if (result.permadeath || target.stats?.lifecycle?.state === 'permadead') {
        entombFallenScion(target, { cause: `Slain by ${monster.name || 'a monster'}` });
      }
    }
  }

  return result ? {
    target,
    result,
    damage,
    rawDamage: payload.damage,
    mitigation,
    skillId: payload.skillId || 'monster:attack',
    skillName: payload.skillName || 'Attack',
  } : false;
};

const createMonsterCombatController = (monster) => ({
  rollDamage: () => rollDamage(monster),
  resolveTarget: now => resolveTarget(monster, now),
  tryAttack: (target, now) => tryAttack(monster, target, now),
  resolvePendingAttack: now => resolvePendingAttack(monster, now),
});

export default createMonsterCombatController;
