import Socket from '#server/socket.js';
import UI from '#shared/ui.js';
import config from '#server/config.js';
import world from '#server/core/world.js';
import Monster from '#server/core/monster.js';
import Player from '#server/core/player.js';
import { getSkillExecutionProfile } from '#shared/skills/index.js';
import { DEFAULT_SKILL_IDS } from '#shared/combat.js';
import { directionDelta } from '#server/core/entities/player/movement-handler.js';
import { broadcastStats } from '#server/core/entities/player/stats-manager.js';
import { awardSkillExperience, sendMessage } from '#server/core/combat/experience.js';
import { dropMonsterLoot } from '#server/core/combat/loot.js';
import { notifyTutorial } from '#server/core/tutorial.js';
import { processResourceRegeneration, REGEN_INTERVAL_MS } from '#server/core/combat/regeneration.js';
import { transitionPlayerIfOnPortal } from '#server/core/world-transitions.js';

const DEFAULT_PROJECTILE_RANGE = 5;
const FALLBACK_EXPERIENCE_PER_LEVEL = 12;
// Monsters hold continuous positions and stand off ~1 tile when engaging, so
// the auto-attack leash needs diagonal headroom beyond strict adjacency.
const AUTO_ATTACK_RANGE = 1.9;
const DEFAULT_DASH_DISTANCE = 3;

// Continuous monster positions still fight over the tile grid: melee arcs and
// tile lookups act on the tile a monster is standing on.
const monsterTileX = monster => Math.round(monster.x);
const monsterTileY = monster => Math.round(monster.y);

const ensureCombatState = (player) => {
  if (!player.combat) {
    player.combat = {};
  }
  return player.combat;
};

export const isPlayerAlive = (player) => Boolean(
  player
  && player.stats
  && player.stats.resources
  && player.stats.resources.health
  && player.stats.resources.health.current > 0,
);

const tileBlocked = (map, x, y) => {
  if (!map || x < 0 || y < 0 || x >= config.map.size.x || y >= config.map.size.y) {
    return true;
  }

  const index = (y * config.map.size.x) + x;
  const background = Array.isArray(map.background) ? map.background[index] - 1 : -1;
  const foreground = Array.isArray(map.foreground) ? map.foreground[index] - 1 : -1;

  return !UI.tileWalkable(background) || !UI.tileWalkable(foreground, 'foreground');
};

/**
 * The tiles covered by a melee swing: the tile directly ahead plus
 * the two tiles flanking it.
 *
 * @param {object} player The attacking player
 * @param {string} direction The direction of the swing
 * @returns {array} List of {x, y} tiles
 */
export const getMeleeArcTiles = (player, direction) => {
  const delta = directionDelta(direction);
  if (!delta) {
    return [];
  }

  const front = { x: player.x + delta.x, y: player.y + delta.y };
  const tiles = [front];

  if (delta.x !== 0 && delta.y !== 0) {
    // Diagonal swing covers the two cardinal neighbours of the front tile
    tiles.push({ x: player.x + delta.x, y: player.y });
    tiles.push({ x: player.x, y: player.y + delta.y });
  } else if (delta.x !== 0) {
    tiles.push({ x: front.x, y: front.y - 1 });
    tiles.push({ x: front.x, y: front.y + 1 });
  } else {
    tiles.push({ x: front.x - 1, y: front.y });
    tiles.push({ x: front.x + 1, y: front.y });
  }

  return tiles;
};

const getAliveSceneMonsters = (sceneId) => {
  if (!world || typeof world.getScene !== 'function') {
    return [];
  }

  const scene = world.getScene(sceneId);
  if (!scene || !Array.isArray(scene.monsters)) {
    return [];
  }

  return scene.monsters.filter(monster => monster && monster.isAlive);
};

const getSceneMonsterByUuid = (sceneId, monsterUuid) => (
  getAliveSceneMonsters(sceneId).find(monster => monster.uuid === monsterUuid) || null
);

const adjacentDistance = (a, b) => {
  if (!a || !b) {
    return Infinity;
  }

  return Math.max(Math.abs((a.x || 0) - (b.x || 0)), Math.abs((a.y || 0) - (b.y || 0)));
};

const directionToward = (from, to, fallback = 'down') => {
  if (!from || !to) {
    return fallback;
  }

  const dx = Math.max(-1, Math.min(1, (to.x || 0) - (from.x || 0)));
  const dy = Math.max(-1, Math.min(1, (to.y || 0) - (from.y || 0)));
  const key = `${dx}:${dy}`;
  const directions = {
    '1:0': 'right',
    '-1:0': 'left',
    '0:-1': 'up',
    '0:1': 'down',
    '1:-1': 'up-right',
    '1:1': 'down-right',
    '-1:-1': 'up-left',
    '-1:1': 'down-left',
  };

  return directions[key] || fallback;
};

const getSceneMap = (player) => {
  const scene = player && world.getScene(player.sceneId);
  if (scene && scene.map) {
    return scene.map;
  }
  return world.map;
};

const isMonsterOnTile = (player, x, y) => (
  getAliveSceneMonsters(player.sceneId)
    .some(monster => monsterTileX(monster) === x && monsterTileY(monster) === y)
);

const canMoveToTile = (player, x, y) => {
  if (!player || isMonsterOnTile(player, x, y)) {
    return false;
  }

  if (typeof player.canMoveTo === 'function') {
    try {
      return player.canMoveTo(x, y);
    } catch (_error) {
      // Unit-test doubles often do not carry full map state. Fall back below.
    }
  }

  return !tileBlocked(getSceneMap(player), x, y);
};

const canDashStep = (player, delta) => {
  const targetX = player.x + delta.x;
  const targetY = player.y + delta.y;

  if (!canMoveToTile(player, targetX, targetY)) {
    return false;
  }

  if (delta.x !== 0 && delta.y !== 0) {
    const horizontalOpen = canMoveToTile(player, player.x + delta.x, player.y);
    const verticalOpen = canMoveToTile(player, player.x, player.y + delta.y);
    if (!horizontalOpen && !verticalOpen) {
      return false;
    }
  }

  return true;
};

export const findAreaTargets = (player, radius = 1) => {
  const range = Math.max(0, Math.floor(radius));
  return getAliveSceneMonsters(player.sceneId)
    .filter(monster => adjacentDistance(player, monster) <= range);
};

export const clearAutoAttack = (player, reason = 'manual') => {
  if (!player || !player.combat || !player.combat.autoAttack) {
    return false;
  }

  player.combat.autoAttack = null;
  player.combat.autoAttackStoppedReason = reason;
  return true;
};

export const setAutoAttackTarget = (player, monster, options = {}) => {
  if (!player || !monster || !monster.uuid) {
    return null;
  }

  const combat = ensureCombatState(player);
  combat.autoAttack = {
    targetId: monster.uuid,
    targetName: monster.name || 'Monster',
    sceneId: player.sceneId,
    skillId: options.skillId || DEFAULT_SKILL_IDS.primary,
    startedAt: Number.isFinite(options.startedAt) ? options.startedAt : Date.now(),
    lastTriggeredAt: Number.isFinite(options.lastTriggeredAt) ? options.lastTriggeredAt : 0,
  };
  combat.autoAttackStoppedReason = null;
  return combat.autoAttack;
};

export const findStepTarget = (player, direction) => {
  const delta = directionDelta(direction);
  if (!player || !delta) {
    return null;
  }

  const targetX = player.x + delta.x;
  const targetY = player.y + delta.y;
  return getAliveSceneMonsters(player.sceneId)
    .find(monster => monsterTileX(monster) === targetX && monsterTileY(monster) === targetY) || null;
};

/**
 * Find the monsters hit by a melee swing.
 */
export const findMeleeTargets = (player, direction) => {
  const tiles = getMeleeArcTiles(player, direction);
  if (!tiles.length) {
    return [];
  }

  const keys = new Set(tiles.map(tile => `${tile.x}:${tile.y}`));
  return getAliveSceneMonsters(player.sceneId)
    .filter(monster => keys.has(`${monsterTileX(monster)}:${monsterTileY(monster)}`));
};

/**
 * Find the first monster on the line projected from the player,
 * stopping at walls.
 */
export const findProjectileTarget = (player, direction, range = DEFAULT_PROJECTILE_RANGE) => {
  const delta = directionDelta(direction);
  if (!delta) {
    return null;
  }

  const scene = world.getScene(player.sceneId);
  const map = scene && scene.map ? scene.map : world.map;
  const monsters = getAliveSceneMonsters(player.sceneId);

  for (let step = 1; step <= range; step += 1) {
    const x = player.x + (delta.x * step);
    const y = player.y + (delta.y * step);

    const hit = monsters.find(monster => monsterTileX(monster) === x && monsterTileY(monster) === y);
    if (hit) {
      return hit;
    }

    if (tileBlocked(map, x, y)) {
      return null;
    }
  }

  return null;
};

/**
 * Roll player damage for a skill from attributes and equipped weapon.
 *
 * @param {object} player The attacking player
 * @param {object} skill The skill definition used
 * @returns {integer}
 */
export const rollPlayerDamage = (player, skill = {}) => {
  const attributes = (player.stats && player.stats.attributes && player.stats.attributes.total) || {};
  const weapon = (player.combat && player.combat.attack) || {};
  const weaponPower = Math.max(
    weapon.stab || 0,
    weapon.slash || 0,
    weapon.crush || 0,
    weapon.range || 0,
  );

  const usesIntelligence = Boolean(skill.resourceCost && skill.resourceCost.mana);
  const base = usesIntelligence
    ? 4 + ((attributes.intelligence || 0) * 0.5)
    : 2 + ((attributes.strength || 0) * 0.45) + (weaponPower * 0.6);

  const min = Math.max(1, Math.floor(base * 0.75));
  const max = Math.max(min, Math.ceil(base * 1.25));
  return UI.getRandomInt(min, max);
};

const experienceForKill = (monster) => {
  if (monster.rewards && Number.isFinite(monster.rewards.experience)) {
    return Math.max(0, Math.floor(monster.rewards.experience));
  }

  return Math.max(1, monster.level || 1) * FALLBACK_EXPERIENCE_PER_LEVEL;
};

const applyHitToMonster = (player, monster, skill, now) => {
  const damage = rollPlayerDamage(player, skill);
  const result = monster.takeDamage(damage, { now });

  if (!result) {
    return null;
  }

  ensureCombatState(player).lastCombatAt = now;
  notifyTutorial(player, 'attack');

  const died = result.type === 'death' || result.type === 'permadeath';
  let experience = null;

  if (died) {
    experience = awardSkillExperience(player, 'attack', experienceForKill(monster));
    sendMessage(player, `You have slain ${monster.name}.`);
    dropMonsterLoot(monster, { killer: player });
    notifyTutorial(player, 'slay');
  }

  const weaponStyle = Object.entries(player.combat?.attack || {})
    .filter(([, value]) => Number(value) > 0)
    .sort((left, right) => Number(right[1]) - Number(left[1]))[0]?.[0] || 'slash';

  return {
    attackerId: player.uuid,
    attackerName: player.username || 'Adventurer',
    targetId: monster.uuid,
    targetName: monster.name || 'Monster',
    targetType: 'monster',
    skillId: skill.id,
    skillName: skill.label || skill.name || skill.id,
    attackStyle: skill.behaviour?.area ? 'sweep' : weaponStyle,
    amount: result.amount !== undefined ? result.amount : damage,
    health: {
      current: monster.stats.resources.health.current,
      max: monster.stats.resources.health.max,
    },
    died,
    experience,
  };
};

const broadcastHits = (player, hits) => {
  if (!Array.isArray(hits) || !hits.length) {
    return;
  }

  const scenePlayers = world.getScenePlayers(player.sceneId);
  hits.forEach((hit) => {
    Socket.broadcast('combat:hit', hit, scenePlayers);
  });

  const scene = world.getScene(player.sceneId);
  if (scene && Array.isArray(scene.monsters) && scene.monsters.length) {
    Monster.broadcast(scene.monsters, { players: scenePlayers });
  }
};

const applyAreaEffect = (player, skill, now, outcome) => {
  const area = skill.behaviour && skill.behaviour.area;
  if (!area) {
    return false;
  }

  const targets = findAreaTargets(player, area.radius || 1);
  outcome.hits = targets
    .map(monster => applyHitToMonster(player, monster, skill, now))
    .filter(Boolean);

  if (area.slowMultiplier && area.durationMs) {
    targets.forEach((monster) => {
      monster.state = monster.state || {};
      monster.state.effects = monster.state.effects || {};
      monster.state.effects.frostNova = {
        sourceId: player.uuid,
        skillId: skill.id,
        slowMultiplier: Math.max(0.1, Math.min(1, area.slowMultiplier)),
        expiresAt: now + area.durationMs,
      };
    });
    outcome.effects = targets.map(monster => ({
      targetId: monster.uuid,
      type: 'slow',
      slowMultiplier: Math.max(0.1, Math.min(1, area.slowMultiplier)),
      expiresAt: now + area.durationMs,
    }));
  }

  return true;
};

const applyDefensiveBuff = (player, skill, now, outcome) => {
  const buff = skill.behaviour && skill.behaviour.buff;
  if (!buff) {
    return false;
  }

  const combat = ensureCombatState(player);
  combat.buffs = combat.buffs || {};
  combat.buffs[skill.id] = {
    id: skill.id,
    name: skill.label || skill.name || skill.id,
    armourBonus: Math.max(0, Math.floor(buff.armourBonus || 0)),
    startedAt: now,
    expiresAt: now + Math.max(0, Math.floor(buff.durationMs || 0)),
  };
  outcome.buff = combat.buffs[skill.id];
  return true;
};

const applyHealingEffect = (player, skill, now, outcome) => {
  const heal = skill.behaviour && skill.behaviour.heal;
  if (!heal) {
    return false;
  }

  const attributes = (player.stats && player.stats.attributes && player.stats.attributes.total) || {};
  const scalingAttribute = heal.scaling || 'intelligence';
  const scalingValue = Number.isFinite(attributes[scalingAttribute])
    ? attributes[scalingAttribute]
    : 0;
  const amount = Math.max(0, Math.floor((heal.base || 0) + (scalingValue * 0.35)));
  const result = typeof player.applyHealing === 'function'
    ? player.applyHealing(amount, { now })
    : null;

  if (result) {
    broadcastStats(player);
  }

  outcome.healing = {
    targetId: player.uuid,
    amount: result && result.amount !== undefined ? result.amount : amount,
    health: player.stats && player.stats.resources ? player.stats.resources.health : null,
  };
  return true;
};

const applyMovementEffect = (player, skill, profile, payload, now, outcome) => {
  const movement = skill.behaviour && skill.behaviour.movement;
  if (!movement) {
    return false;
  }

  const direction = payload.direction || player.facing || 'down';
  const delta = directionDelta(direction);
  if (!delta) {
    outcome.movement = { moved: false, steps: 0, blocked: true, direction };
    return true;
  }

  const maxSteps = Math.max(1, Math.floor(movement.distance || DEFAULT_DASH_DISTANCE));
  const path = [];

  for (let step = 0; step < maxSteps; step += 1) {
    if (!canDashStep(player, delta)) {
      break;
    }
    player.x += delta.x;
    player.y += delta.y;
    path.push({ x: player.x, y: player.y });
  }

  const moved = path.length > 0;
  const blocked = path.length < maxSteps;
  const duration = Number.isFinite(profile.duration)
    ? profile.duration
    : (moved ? 300 : 0);

  if (typeof player.cancelPathfinding === 'function') {
    player.cancelPathfinding();
  }
  if (typeof player.setFacing === 'function') {
    player.setFacing(direction);
  }
  if (typeof player.registerMovementStep === 'function') {
    player.registerMovementStep({
      duration: moved ? duration : 0,
      startedAt: now,
      direction,
      blocked,
      steps: path.length,
    });
  }

  let transitioned = false;
  if (moved) {
    transitioned = transitionPlayerIfOnPortal(player);
    Player.broadcastMovement(player);
  }

  outcome.movement = {
    moved,
    steps: path.length,
    blocked,
    path,
    direction,
    transitioned,
  };
  return true;
};

/**
 * Validate and execute a combat skill for a player: cooldown and mana
 * gates, animation trigger, hit detection, damage, XP and broadcasts.
 *
 * @param {object} player The acting player
 * @param {object} payload The client skill payload
 * @returns {object|null} Outcome with triggered flag and hits
 */
export const tryUseSkill = (player, payload = {}, options = {}) => {
  const profile = getSkillExecutionProfile(payload.skillId);
  if (!profile) {
    return null;
  }

  if (!isPlayerAlive(player)) {
    return null;
  }

  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const { skill } = profile;
  const combat = ensureCombatState(player);

  combat.cooldowns = combat.cooldowns || {};
  const readyAt = combat.cooldowns[skill.id] || 0;
  if (readyAt > now) {
    return null;
  }

  const manaCost = skill.resourceCost && Number.isFinite(skill.resourceCost.mana)
    ? skill.resourceCost.mana
    : 0;
  if (manaCost > 0 && player.stats.resources.mana.current < manaCost) {
    sendMessage(player, 'Not enough mana.');
    return null;
  }

  const triggered = player.recordSkillInput(payload.skillId, {
    now,
    direction: payload.direction,
    modifiers: payload.modifiers,
    animationState: payload.animationState || profile.animationState,
    duration: payload.duration !== undefined ? payload.duration : profile.duration,
    holdState: payload.holdState !== undefined ? payload.holdState : profile.holdState,
  });

  if (!triggered) {
    return null;
  }

  if (manaCost > 0) {
    player.stats.resources.mana.current -= manaCost;
    player.mana = player.stats.resources.mana;
    broadcastStats(player);
  }

  if (Number.isFinite(skill.cooldown) && skill.cooldown > 0) {
    combat.cooldowns[skill.id] = now + (skill.cooldown * 1000);
  }

  const outcome = { triggered: true, skillId: skill.id, hits: [] };
  const direction = payload.direction || player.facing || 'down';
  const behaviour = skill.behaviour || {};

  if (applyMovementEffect(player, skill, profile, payload, now, outcome)) {
    return outcome;
  }

  if (applyDefensiveBuff(player, skill, now, outcome)) {
    return outcome;
  }

  if (applyHealingEffect(player, skill, now, outcome)) {
    return outcome;
  }

  if (applyAreaEffect(player, skill, now, outcome)) {
    broadcastHits(player, outcome.hits);
    return outcome;
  }

  const projectile = behaviour.projectile;

  let targets = [];
  if (projectile) {
    const target = findProjectileTarget(
      player,
      direction,
      projectile.range || DEFAULT_PROJECTILE_RANGE,
    );
    targets = target ? [target] : [];

    // Player projectiles are visible too — fly to the victim, or the full
    // range on a miss.
    const delta = directionDelta(direction) || { x: 0, y: 1 };
    const range = projectile.range || DEFAULT_PROJECTILE_RANGE;
    const impact = target
      ? { x: monsterTileX(target), y: monsterTileY(target) }
      : { x: player.x + (delta.x * range), y: player.y + (delta.y * range) };
    Socket.broadcast('world:projectile', {
      fromX: player.x,
      fromY: player.y,
      toX: impact.x,
      toY: impact.y,
      travelMs: Math.max(120, projectile.travelTimeMs || 280),
      kind: 'player',
    }, world.getScenePlayers(player.sceneId));
  } else {
    targets = findMeleeTargets(player, direction);
  }

  outcome.hits = targets
    .map(monster => applyHitToMonster(player, monster, skill, now))
    .filter(Boolean);

  if (skill.id === DEFAULT_SKILL_IDS.primary && targets.length) {
    const primaryTarget = targets[0];
    const primaryTargetDied = outcome.hits.some(hit => hit.targetId === primaryTarget.uuid && hit.died);
    if (!primaryTargetDied && primaryTarget.isAlive) {
      setAutoAttackTarget(player, primaryTarget, {
        skillId: skill.id,
        startedAt: now,
        lastTriggeredAt: now,
      });
    } else {
      clearAutoAttack(player, 'target-dead');
    }
  }

  broadcastHits(player, outcome.hits);

  return outcome;
};

export const tryPrimaryAttackIntoStep = (player, direction) => {
  const target = findStepTarget(player, direction);
  if (!target) {
    return null;
  }

  setAutoAttackTarget(player, target);
  return tryUseSkill(player, {
    skillId: 'primary-attack',
    direction,
  });
};

export const processAutoAttacks = (now = Date.now()) => {
  const players = Array.isArray(world.players) ? world.players : [];
  const summary = {
    processed: 0,
    triggered: 0,
    cleared: 0,
  };

  players.forEach((player) => {
    const autoAttack = player && player.combat ? player.combat.autoAttack : null;
    if (!autoAttack) {
      return;
    }

    summary.processed += 1;

    if (!isPlayerAlive(player)) {
      if (clearAutoAttack(player, 'player-dead')) {
        summary.cleared += 1;
      }
      return;
    }

    const target = getSceneMonsterByUuid(autoAttack.sceneId || player.sceneId, autoAttack.targetId);
    if (!target) {
      if (clearAutoAttack(player, 'target-missing')) {
        summary.cleared += 1;
      }
      return;
    }

    if (target.sceneId && target.sceneId !== player.sceneId) {
      if (clearAutoAttack(player, 'target-scene-changed')) {
        summary.cleared += 1;
      }
      return;
    }

    if (adjacentDistance(player, target) > AUTO_ATTACK_RANGE) {
      if (clearAutoAttack(player, 'target-out-of-range')) {
        summary.cleared += 1;
      }
      return;
    }

    const direction = directionToward(player, target, player.facing || 'down');
    const outcome = tryUseSkill(player, {
      skillId: autoAttack.skillId || DEFAULT_SKILL_IDS.primary,
      direction,
      modifiers: { auto: true },
    }, { now });

    if (!outcome || !outcome.triggered) {
      return;
    }

    const killedTarget = outcome.hits.some(hit => hit.targetId === autoAttack.targetId && hit.died);
    if (killedTarget && player.combat && player.combat.autoAttack === null) {
      summary.cleared += 1;
    }

    if (player.combat && player.combat.autoAttack) {
      player.combat.autoAttack.lastTriggeredAt = now;
    }
    summary.triggered += 1;

    Player.broadcastAnimation(player);
    Socket.broadcast('player:combat:update', {
      playerId: player.uuid,
      combat: player.combat,
      animation: player.animation,
    }, world.getScenePlayers(player.sceneId));
  });

  return summary;
};

/**
 * Respawn players whose respawn timers have elapsed. Instances respawn
 * players at the entry point; elsewhere players rise where they fell.
 */
export const processPlayerRespawns = (now = Date.now()) => {
  world.players.forEach((player) => {
    const lifecycle = player.stats && player.stats.lifecycle;
    if (!lifecycle || lifecycle.state !== 'awaiting-respawn' || !lifecycle.respawn.pending) {
      return;
    }

    if (!lifecycle.respawn.at || now < lifecycle.respawn.at) {
      return;
    }

    const result = player.tryRespawn({ now });
    if (!result || !result.success) {
      return;
    }

    const scene = world.getScene(player.sceneId);
    const spawnPoint = scene
      && scene.metadata
      && Array.isArray(scene.metadata.spawnPoints)
      && scene.metadata.spawnPoints[0];

    if (spawnPoint && Number.isFinite(spawnPoint.x) && Number.isFinite(spawnPoint.y)) {
      player.x = spawnPoint.x;
      player.y = spawnPoint.y;
      if (player.path) {
        player.path.grid = null;
      }
    }

    sendMessage(player, 'You awaken, battered but alive.');
    Player.broadcastMovement(player);
    broadcastStats(player);
  });
};

export { processResourceRegeneration, REGEN_INTERVAL_MS };

export default {
  tryUseSkill,
  processPlayerRespawns,
  processAutoAttacks,
  processResourceRegeneration,
  isPlayerAlive,
  rollPlayerDamage,
  findMeleeTargets,
  findProjectileTarget,
  findAreaTargets,
  getMeleeArcTiles,
  findStepTarget,
  tryPrimaryAttackIntoStep,
  clearAutoAttack,
  setAutoAttackTarget,
};
