import config from '#server/config.js';
import UI from '#shared/ui.js';
import {
  DEFAULT_ANIMATION_DURATIONS,
  DEFAULT_ANIMATION_HOLDS,
  DEFAULT_FACING_DIRECTION,
} from '#shared/combat.js';

const directionVectors = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const diagonalDirections = {
  up: ['up-left', 'up-right'],
  down: ['down-left', 'down-right'],
  left: ['up-left', 'down-left'],
  right: ['up-right', 'down-right'],
};

export const computeStepDuration = (direction, options = {}) => {
  const vector = directionVectors[direction] || direction;
  if (!vector) {
    return 0;
  }

  const diagonal = Math.abs(vector.x) === 1 && Math.abs(vector.y) === 1;
  const multiplier = diagonal ? Math.SQRT2 : 1;
  const speed = Number.isFinite(options.speedMultiplier) ? options.speedMultiplier : 1;
  return Math.round((150 * multiplier) / speed);
};

const getActiveSlowMultiplier = (monster, now = Date.now()) => {
  const effects = monster && monster.state && monster.state.effects;
  if (!effects || typeof effects !== 'object') {
    return 1;
  }

  return Object.entries(effects).reduce((slowest, [id, effect]) => {
    if (!effect || !Number.isFinite(effect.expiresAt) || effect.expiresAt <= now) {
      delete effects[id];
      return slowest;
    }

    if (!Number.isFinite(effect.slowMultiplier)) {
      return slowest;
    }

    return Math.min(slowest, Math.max(0.1, Math.min(1, effect.slowMultiplier)));
  }, 1);
};

const getStepInterval = (monster, now = Date.now()) => {
  const baseInterval = monster.behaviour.stepIntervalMs;
  const slowMultiplier = getActiveSlowMultiplier(monster, now);
  return Math.round(baseInterval / slowMultiplier);
};

export const euclideanDistance = (a, b) => {
  const dx = (a.x || 0) - (b.x || 0);
  const dy = (a.y || 0) - (b.y || 0);
  return Math.sqrt((dx * dx) + (dy * dy));
};

export const manhattanDistance = (a, b) => (
  Math.abs((a.x || 0) - (b.x || 0)) + Math.abs((a.y || 0) - (b.y || 0))
);

export const resolveDirection = (from, to) => {
  const dx = (to.x || 0) - (from.x || 0);
  const dy = (to.y || 0) - (from.y || 0);

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  if (dy !== 0) {
    return dy > 0 ? 'down' : 'up';
  }
  return null;
};

export const pickSecondaryDirection = (primary, from, to) => {
  if (!primary) {
    return null;
  }

  const candidates = diagonalDirections[primary] || [];
  if (!candidates.length) {
    return null;
  }

  const dx = (to.x || 0) - (from.x || 0);
  const dy = (to.y || 0) - (from.y || 0);

  return candidates.find((direction) => {
    if (direction === 'up-left') {
      return dx < 0 && dy < 0;
    }
    if (direction === 'up-right') {
      return dx > 0 && dy < 0;
    }
    if (direction === 'down-left') {
      return dx < 0 && dy > 0;
    }
    if (direction === 'down-right') {
      return dx > 0 && dy > 0;
    }
    return false;
  }) || null;
};

const createInitialAnimation = (monster, overrides = {}) => {
  const direction = overrides.direction || DEFAULT_FACING_DIRECTION;
  return {
    state: overrides.state || 'idle',
    direction,
    sequence: Number.isFinite(overrides.sequence) ? overrides.sequence : 0,
    startedAt: Number.isFinite(overrides.startedAt) ? overrides.startedAt : Date.now(),
    duration: Number.isFinite(overrides.duration) ? overrides.duration : 0,
    speed: Number.isFinite(overrides.speed) ? overrides.speed : 1,
    skillId: overrides.skillId || null,
    holdState: overrides.holdState || null,
  };
};

const setFacing = (monster, direction) => {
  if (!direction) {
    return monster.facing || DEFAULT_FACING_DIRECTION;
  }
  monster.facing = direction;
  return monster.facing;
};

const setAnimationState = (monster, state, options = {}) => {
  const resolvedState = state || 'idle';
  const direction = options.direction || monster.facing || DEFAULT_FACING_DIRECTION;
  const now = Number.isFinite(options.startedAt) ? options.startedAt : Date.now();
  const previousSequence = monster.animation && typeof monster.animation.sequence === 'number'
    ? monster.animation.sequence
    : 0;
  const sequence = Number.isFinite(options.sequence) ? options.sequence : previousSequence + 1;
  const duration = Number.isFinite(options.duration)
    ? options.duration
    : (DEFAULT_ANIMATION_DURATIONS[resolvedState] || 0);
  const holdState = options.holdState !== undefined
    ? options.holdState
    : (DEFAULT_ANIMATION_HOLDS[resolvedState] || null);

  monster.animation = {
    state: resolvedState,
    direction,
    sequence,
    startedAt: now,
    duration,
    speed: Number.isFinite(options.speed) ? options.speed : 1,
    skillId: options.skillId || null,
    holdState,
  };

  return monster.animation;
};

const hasBlockingHealth = (actor) => {
  const current = actor && actor.stats && actor.stats.resources
    && actor.stats.resources.health
    && actor.stats.resources.health.current;

  return !Number.isFinite(current) || current > 0;
};

// Positions are continuous (floats) now; occupancy is judged by the tile an
// actor is standing on.
const actorAt = (actor, x, y) => actor
  && Math.round(actor.x) === x
  && Math.round(actor.y) === y;

const playerBlocksTile = (player, x, y) => actorAt(player, x, y)
  && hasBlockingHealth(player);

const monsterBlocksTile = (monster, other, x, y) => actorAt(other, x, y)
  && other !== monster
  && (!other.uuid || !monster.uuid || other.uuid !== monster.uuid)
  && other.isAlive !== false
  && hasBlockingHealth(other);

const tileOccupiedByActor = (monster, x, y) => {
  const scene = monster.activeScene;
  const players = scene && Array.isArray(scene.players) ? scene.players : [];
  const monsters = scene && Array.isArray(scene.monsters) ? scene.monsters : [];

  return players.some(player => playerBlocksTile(player, x, y))
    || monsters.some(other => monsterBlocksTile(monster, other, x, y));
};

const pickPatrolTarget = (monster) => {
  if (!monster.behaviour || !monster.behaviour.patrolRadius) {
    return { x: monster.spawn.x, y: monster.spawn.y };
  }

  const radius = monster.behaviour.patrolRadius;
  const offsetX = UI.getRandomInt(-radius, radius);
  const offsetY = UI.getRandomInt(-radius, radius);
  return {
    x: Math.min(Math.max(monster.spawn.x + offsetX, 0), config.map.size.x - 1),
    y: Math.min(Math.max(monster.spawn.y + offsetY, 0), config.map.size.y - 1),
  };
};

const canStep = (monster, direction) => {
  if (!direction) {
    return false;
  }

  const mapLayers = monster.activeMap || {};
  const background = mapLayers.background || [];
  const foreground = mapLayers.foreground || [];

  if (!background.length) {
    return false;
  }

  // Positions are floats now; tile lookups need integer coordinates.
  const fromX = Math.round(monster.x);
  const fromY = Math.round(monster.y);
  const tileIndexBg = UI.getFutureTileID(background, fromX, fromY, direction);
  const tileIndexFg = UI.getFutureTileID(foreground, fromX, fromY, direction);

  const canWalkThrough = UI.tileWalkable(tileIndexBg)
    && UI.tileWalkable(tileIndexFg, 'foreground');

  if (!canWalkThrough) {
    return false;
  }

  const vector = directionVectors[direction];
  if (!vector) {
    return false;
  }

  const targetX = fromX + vector.x;
  const targetY = fromY + vector.y;

  if (targetX < 0 || targetX >= config.map.size.x || targetY < 0 || targetY >= config.map.size.y) {
    return false;
  }

  if (tileOccupiedByActor(monster, targetX, targetY)) {
    return false;
  }

  const distanceFromSpawn = euclideanDistance({ x: targetX, y: targetY }, monster.spawn);
  if (monster.behaviour && monster.behaviour.leash && distanceFromSpawn > monster.behaviour.leash) {
    return false;
  }

  return true;
};

const step = (monster, direction, now = Date.now()) => {
  if (!canStep(monster, direction)) {
    monster.movementStep = {
      sequence: monster.movementStep.sequence + 1,
      startedAt: now,
      duration: 0,
      direction: null,
      blocked: true,
    };
    setAnimationState(monster, 'idle', { direction, startedAt: now });
    return false;
  }

  const vector = directionVectors[direction];
  const speedMultiplier = (monster.behaviour.stepSpeedMultiplier || 1)
    * getActiveSlowMultiplier(monster, now);
  const stepDuration = computeStepDuration(direction, { speedMultiplier });

  monster.x += vector.x;
  monster.y += vector.y;

  monster.movementStep = {
    sequence: monster.movementStep.sequence + 1,
    startedAt: now,
    duration: stepDuration,
    direction,
    blocked: false,
  };

  monster.state.lastStepAt = now;
  setFacing(monster, direction);
  setAnimationState(monster, 'run', { direction, duration: stepDuration, startedAt: now });
  return true;
};

// ── Continuous (off-grid) steering ─────────────────────────────────────
//
// Monsters no longer hop one cell at a time: they own float positions and
// glide toward waypoints at their real speed every AI tick. The client's
// existing interpolator renders position→position over the step duration,
// which reads as smooth continuous motion instead of cellular hops.

const GLIDE_SAMPLE_TILES = 0.3; // collision sampling granularity
const GLIDE_ARRIVE_EPSILON = 0.25;
const MAX_GLIDE_DT_MS = 1500; // guard against long tick gaps teleporting monsters

// Effective speed preserves the old pacing: 1 tile per stepIntervalMs,
// including slow effects.
const glideSpeed = (monster, now) => 1000 / getStepInterval(monster, now);

const tileWalkableAt = (monster, tileX, tileY) => {
  if (tileX < 0 || tileX >= config.map.size.x || tileY < 0 || tileY >= config.map.size.y) {
    return false;
  }
  const mapLayers = monster.activeMap || {};
  const background = mapLayers.background || [];
  const foreground = mapLayers.foreground || [];
  if (!background.length) {
    return false;
  }
  const index = (tileY * config.map.size.x) + tileX;
  return UI.tileWalkable(background[index] - 1)
    && UI.tileWalkable(foreground[index] - 1, 'foreground');
};

const positionOpen = (monster, x, y) => {
  const tileX = Math.round(x);
  const tileY = Math.round(y);

  if (!tileWalkableAt(monster, tileX, tileY)) {
    return false;
  }

  // Don't glide onto a tile another actor is standing on (unless it's the
  // tile we already occupy).
  const ownTileX = Math.round(monster.x);
  const ownTileY = Math.round(monster.y);
  if ((tileX !== ownTileX || tileY !== ownTileY)
    && tileOccupiedByActor(monster, tileX, tileY)) {
    return false;
  }

  if (monster.behaviour && monster.behaviour.leash
    && euclideanDistance({ x, y }, monster.spawn) > monster.behaviour.leash) {
    return false;
  }

  return true;
};

/**
 * Advance toward a point at the monster's speed, collision-sampled along the
 * path. Returns 'arrived', 'moved', or 'blocked'.
 */
const glideToward = (monster, point, now, options = {}) => {
  const dtRaw = now - (monster.state.lastGlideAt || now);
  monster.state.lastGlideAt = now;
  const dt = Math.max(0, Math.min(dtRaw, MAX_GLIDE_DT_MS));
  if (dt === 0) {
    return 'moved'; // first call this tick series; move next tick
  }

  const dx = (point.x || 0) - monster.x;
  const dy = (point.y || 0) - monster.y;
  const remaining = Math.sqrt((dx * dx) + (dy * dy));
  const stopWithin = Number.isFinite(options.stopWithin) ? options.stopWithin : 0;

  if (remaining <= Math.max(GLIDE_ARRIVE_EPSILON, stopWithin)) {
    return 'arrived';
  }

  const speed = glideSpeed(monster, now);
  const travel = Math.min((speed * dt) / 1000, remaining - stopWithin);
  if (travel <= 0.01) {
    return 'arrived';
  }

  const ux = dx / remaining;
  const uy = dy / remaining;

  // Sample along the path; stop at the last open position.
  const samples = Math.max(1, Math.ceil(travel / GLIDE_SAMPLE_TILES));
  let reached = 0;
  for (let i = 1; i <= samples; i += 1) {
    const at = (travel * i) / samples;
    if (!positionOpen(monster, monster.x + (ux * at), monster.y + (uy * at))) {
      break;
    }
    reached = at;
  }

  if (reached <= 0.01) {
    monster.movementStep = {
      sequence: monster.movementStep.sequence + 1,
      startedAt: now,
      duration: 0,
      direction: null,
      blocked: true,
    };
    return 'blocked';
  }

  monster.x += ux * reached;
  monster.y += uy * reached;

  const direction = resolveDirection({ x: 0, y: 0 }, { x: ux, y: uy })
    || monster.facing || DEFAULT_FACING_DIRECTION;
  const duration = Math.max(90, Math.round(dt));

  monster.movementStep = {
    sequence: monster.movementStep.sequence + 1,
    startedAt: now,
    duration,
    direction,
    blocked: false,
  };
  monster.state.lastStepAt = now;
  setFacing(monster, direction);
  setAnimationState(monster, 'run', { direction, duration, startedAt: now });
  return 'moved';
};

// Pick a wander destination: a random point in the patrol disc whose tile is
// actually walkable.
const pickWanderPoint = (monster) => {
  const radius = Math.max(1, monster.behaviour.patrolRadius || 1);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const angle = (UI.getRandomInt(0, 359) * Math.PI) / 180;
    const distance = UI.getRandomInt(10, radius * 10) / 10;
    const x = monster.spawn.x + (Math.cos(angle) * distance);
    const y = monster.spawn.y + (Math.sin(angle) * distance);
    if (tileWalkableAt(monster, Math.round(x), Math.round(y))) {
      return { x, y };
    }
  }
  return { x: monster.spawn.x, y: monster.spawn.y };
};

const patrol = (monster, now = Date.now()) => {
  if (!monster.behaviour.patrolRadius) {
    return false;
  }

  // Dwell between wanders: amble somewhere, pause like a creature would,
  // amble on — never the old hop-one-cell-every-few-seconds tic.
  if ((monster.state.wanderDwellUntil || 0) > now) {
    monster.state.lastGlideAt = now;
    return false;
  }

  if (!monster.state.patrolTarget) {
    monster.state.patrolTarget = pickWanderPoint(monster);
    monster.state.lastDecisionAt = now;
  }

  const result = glideToward(monster, monster.state.patrolTarget, now);

  if (result === 'arrived' || result === 'blocked') {
    monster.state.patrolTarget = null;
    monster.state.wanderDwellUntil = now
      + 700 + UI.getRandomInt(0, monster.behaviour.patrolIntervalMs || 4000);
    setAnimationState(monster, 'idle', { direction: monster.facing, startedAt: now });
    return result === 'arrived';
  }

  return result === 'moved';
};

const pursue = (monster, target, now = Date.now()) => {
  if (!target) {
    return false;
  }

  // Close to just inside attack range, not onto the target's tile.
  const attackRange = (monster.behaviour.attack && monster.behaviour.attack.range) || 1;
  const stopWithin = Math.max(0.9, Math.min(attackRange, 1.1));

  const result = glideToward(monster, target, now, { stopWithin });
  return result === 'moved';
};

const returnToSpawn = (monster, now = Date.now()) => {
  const result = glideToward(monster, monster.spawn, now);
  if (result === 'arrived') {
    monster.x = monster.spawn.x;
    monster.y = monster.spawn.y;
    setAnimationState(monster, 'idle', { direction: monster.facing, startedAt: now });
    return false;
  }
  return result === 'moved';
};

// Kite away from a target (ranged monsters keeping their distance): glide
// toward a point directly away, falling back to perpendicular slides along
// walls.
const retreatFrom = (monster, target, now = Date.now()) => {
  if (!target) {
    return false;
  }

  const dx = monster.x - (target.x || 0);
  const dy = monster.y - (target.y || 0);
  const length = Math.sqrt((dx * dx) + (dy * dy)) || 1;
  const ux = dx / length;
  const uy = dy / length;

  const candidates = [
    { x: monster.x + (ux * 2), y: monster.y + (uy * 2) },
    { x: monster.x + (-uy * 2), y: monster.y + (ux * 2) },
    { x: monster.x + (uy * 2), y: monster.y + (-ux * 2) },
  ];

  for (let index = 0; index < candidates.length; index += 1) {
    if (glideToward(monster, candidates[index], now) === 'moved') {
      return true;
    }
  }

  return false;
};

const distanceToSpawn = monster => euclideanDistance(monster, monster.spawn);
const distanceTo = (monster, target) => euclideanDistance(monster, target);
const isWithin = (monster, target, range) => manhattanDistance(monster, target) <= range;

const createMonsterMovementHandler = (monster) => ({
  createInitialAnimation: overrides => createInitialAnimation(monster, overrides),
  setFacing: direction => setFacing(monster, direction),
  setAnimationState: (state, options) => setAnimationState(monster, state, options),
  pickPatrolTarget: () => pickPatrolTarget(monster),
  canStep: direction => canStep(monster, direction),
  step: (direction, now) => step(monster, direction, now),
  patrol: now => patrol(monster, now),
  pursue: (target, now) => pursue(monster, target, now),
  retreatFrom: (target, now) => retreatFrom(monster, target, now),
  returnToSpawn: now => returnToSpawn(monster, now),
  distanceToSpawn: () => distanceToSpawn(monster),
  distanceTo: target => distanceTo(monster, target),
  isWithin: (target, range) => isWithin(monster, target, range),
});

export default createMonsterMovementHandler;
