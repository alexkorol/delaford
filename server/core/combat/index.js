import Socket from '#server/socket.js';
import UI from '#shared/ui.js';
import config from '#server/config.js';
import world from '#server/core/world.js';
import Monster from '#server/core/monster.js';
import Player from '#server/core/player.js';
import { getSkillExecutionProfile } from '#shared/skills/index.js';
import { directionDelta } from '#server/core/entities/player/movement-handler.js';
import { broadcastStats } from '#server/core/entities/player/stats-manager.js';
import { awardSkillExperience, sendMessage } from '#server/core/combat/experience.js';

const DEFAULT_PROJECTILE_RANGE = 5;
const FALLBACK_EXPERIENCE_PER_LEVEL = 12;

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
  const scene = world.getScene(sceneId);
  if (!scene || !Array.isArray(scene.monsters)) {
    return [];
  }

  return scene.monsters.filter(monster => monster && monster.isAlive);
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
    .filter(monster => keys.has(`${monster.x}:${monster.y}`));
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

    const hit = monsters.find(monster => monster.x === x && monster.y === y);
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

  const died = result.type === 'death' || result.type === 'permadeath';

  if (died) {
    awardSkillExperience(player, 'attack', experienceForKill(monster));
    sendMessage(player, `You have slain ${monster.name}.`);
  }

  return {
    attackerId: player.uuid,
    targetId: monster.uuid,
    targetType: 'monster',
    skillId: skill.id,
    amount: result.amount !== undefined ? result.amount : damage,
    health: {
      current: monster.stats.resources.health.current,
      max: monster.stats.resources.health.max,
    },
    died,
  };
};

/**
 * Validate and execute a combat skill for a player: cooldown and mana
 * gates, animation trigger, hit detection, damage, XP and broadcasts.
 *
 * @param {object} player The acting player
 * @param {object} payload The client skill payload
 * @returns {object|null} Outcome with triggered flag and hits
 */
export const tryUseSkill = (player, payload = {}) => {
  const profile = getSkillExecutionProfile(payload.skillId);
  if (!profile) {
    return null;
  }

  if (!isPlayerAlive(player)) {
    return null;
  }

  const now = Date.now();
  const { skill } = profile;

  player.combat.cooldowns = player.combat.cooldowns || {};
  const readyAt = player.combat.cooldowns[skill.id] || 0;
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
    player.combat.cooldowns[skill.id] = now + (skill.cooldown * 1000);
  }

  const outcome = { triggered: true, skillId: skill.id, hits: [] };

  if (skill.category !== 'combat') {
    return outcome;
  }

  const direction = player.facing || payload.direction || 'down';
  const projectile = skill.behaviour && skill.behaviour.projectile;

  let targets = [];
  if (projectile) {
    const target = findProjectileTarget(
      player,
      direction,
      projectile.range || DEFAULT_PROJECTILE_RANGE,
    );
    targets = target ? [target] : [];
  } else {
    targets = findMeleeTargets(player, direction);
  }

  outcome.hits = targets
    .map(monster => applyHitToMonster(player, monster, skill, now))
    .filter(Boolean);

  if (outcome.hits.length) {
    const scenePlayers = world.getScenePlayers(player.sceneId);
    outcome.hits.forEach((hit) => {
      Socket.broadcast('combat:hit', hit, scenePlayers);
    });

    const scene = world.getScene(player.sceneId);
    if (scene && Array.isArray(scene.monsters) && scene.monsters.length) {
      Monster.broadcast(scene.monsters, { players: scenePlayers });
    }
  }

  return outcome;
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

export default {
  tryUseSkill,
  processPlayerRespawns,
  isPlayerAlive,
  rollPlayerDamage,
  findMeleeTargets,
  findProjectileTarget,
  getMeleeArcTiles,
};
