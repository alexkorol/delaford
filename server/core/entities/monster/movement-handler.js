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

  const tileIndexBg = UI.getFutureTileID(background, monster.x, monster.y, direction);
  const tileIndexFg = UI.getFutureTileID(foreground, monster.x, monster.y, direction);

  const canWalkThrough = UI.tileWalkable(tileIndexBg)
    && UI.tileWalkable(tileIndexFg, 'foreground');

  if (!canWalkThrough) {
    return false;
  }

  const vector = directionVectors[direction];
  if (!vector) {
    return false;
  }

  const targetX = monster.x + vector.x;
  const targetY = monster.y + vector.y;

  if (targetX < 0 || targetX >= config.map.size.x || targetY < 0 || targetY >= config.map.size.y) {
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
  const stepDuration = computeStepDuration(direction, { speedMultiplier: monster.behaviour.stepSpeedMultiplier || 1 });

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

const patrol = (monster, now = Date.now()) => {
  if (!monster.behaviour.patrolRadius) {
    return false;
  }

  if (!monster.state.patrolTarget) {
    monster.state.patrolTarget = pickPatrolTarget(monster);
  }

  const distance = manhattanDistance(monster, monster.state.patrolTarget);
  if (distance <= 0) {
    if (now - (monster.state.lastDecisionAt || 0) > monster.behaviour.patrolIntervalMs) {
      monster.state.patrolTarget = pickPatrolTarget(monster);
      monster.state.lastDecisionAt = now;
    }
    setAnimationState(monster, 'idle', { direction: monster.facing, startedAt: now });
    return false;
  }

  if (now - (monster.state.lastStepAt || 0) < monster.behaviour.stepIntervalMs) {
    return false;
  }

  const direction = resolveDirection(monster, monster.state.patrolTarget);
  if (step(monster, direction, now)) {
    return true;
  }

  const secondary = pickSecondaryDirection(direction, monster, monster.state.patrolTarget);
  if (secondary) {
    return step(monster, secondary, now);
  }

  return false;
};

const pursue = (monster, target, now = Date.now()) => {
  if (!target) {
    return false;
  }

  if (now - (monster.state.lastStepAt || 0) < monster.behaviour.stepIntervalMs) {
    return false;
  }

  const direction = resolveDirection(monster, target);
  if (step(monster, direction, now)) {
    return true;
  }

  const secondary = pickSecondaryDirection(direction, monster, target);
  if (secondary) {
    return step(monster, secondary, now);
  }

  return false;
};

const returnToSpawn = (monster, now = Date.now()) => {
  const atSpawn = monster.x === monster.spawn.x && monster.y === monster.spawn.y;
  if (atSpawn) {
    setAnimationState(monster, 'idle', { direction: monster.facing, startedAt: now });
    return false;
  }

  if (now - (monster.state.lastStepAt || 0) < monster.behaviour.stepIntervalMs) {
    return false;
  }

  const direction = resolveDirection(monster, monster.spawn);
  if (step(monster, direction, now)) {
    return true;
  }

  const secondary = pickSecondaryDirection(direction, monster, monster.spawn);
  if (secondary) {
    return step(monster, secondary, now);
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
  returnToSpawn: now => returnToSpawn(monster, now),
  distanceToSpawn: () => distanceToSpawn(monster),
  distanceTo: target => distanceTo(monster, target),
  isWithin: (target, range) => isWithin(monster, target, range),
});

export default createMonsterMovementHandler;
