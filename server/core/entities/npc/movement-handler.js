import UI from '#shared/ui.js';
import {
  DEFAULT_ANIMATION_DURATIONS,
  DEFAULT_ANIMATION_HOLDS,
  DEFAULT_FACING_DIRECTION,
} from '#shared/combat.js';

const BASE_MOVE_DURATION = 150;

const directionVectors = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const computeStepDuration = (direction) => {
  const delta = directionVectors[direction] || { x: 0, y: 0 };
  const diagonal = Math.abs(delta.x) === 1 && Math.abs(delta.y) === 1;
  const multiplier = diagonal ? Math.SQRT2 : 1;
  return Math.round(BASE_MOVE_DURATION * multiplier);
};

const resolveFacing = (npc, direction, fallback = DEFAULT_FACING_DIRECTION) => {
  if (!direction) {
    return fallback;
  }

  const mapping = {
    'up-right': 'right',
    'down-right': 'right',
    'up-left': 'left',
    'down-left': 'left',
  };

  const candidate = mapping[direction] || direction;
  if (['up', 'down', 'left', 'right'].includes(candidate)) {
    return candidate;
  }

  return fallback;
};

const setFacing = (npc, direction) => {
  npc.facing = resolveFacing(npc, direction, npc.facing || DEFAULT_FACING_DIRECTION);
  return npc.facing;
};

const createInitialAnimation = (npc, overrides = {}) => {
  const direction = resolveFacing(npc, overrides.direction, DEFAULT_FACING_DIRECTION);
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

const setAnimationState = (npc, state, options = {}) => {
  const resolvedState = state || 'idle';
  const direction = setFacing(npc, options.direction);
  const nowTs = Number.isFinite(options.startedAt) ? options.startedAt : Date.now();
  const previousSequence = npc.animation && typeof npc.animation.sequence === 'number'
    ? npc.animation.sequence
    : 0;
  const sequence = Number.isFinite(options.sequence) ? options.sequence : previousSequence + 1;
  const duration = Number.isFinite(options.duration)
    ? options.duration
    : (DEFAULT_ANIMATION_DURATIONS[resolvedState] || 0);
  const holdState = options.holdState !== undefined
    ? options.holdState
    : (DEFAULT_ANIMATION_HOLDS[resolvedState] || null);

  npc.animation = {
    state: resolvedState,
    direction,
    sequence,
    startedAt: nowTs,
    duration,
    speed: Number.isFinite(options.speed) ? options.speed : 1,
    skillId: options.skillId || null,
    holdState,
  };

  return npc.animation;
};

const updateMovementStep = (npc, step) => {
  const currentSequence = npc.movementStep && typeof npc.movementStep.sequence === 'number'
    ? npc.movementStep.sequence
    : 0;

  npc.movementStep = {
    sequence: currentSequence + 1,
    startedAt: step.startedAt,
    duration: step.duration,
    direction: step.direction,
    blocked: step.blocked,
  };

  return npc.movementStep;
};

const canMove = (npc, direction, worldRef) => {
  const map = worldRef.map;
  if (!map || !Array.isArray(map.background) || !Array.isArray(map.foreground)) {
    return false;
  }

  const background = UI.getFutureTileID(map.background, npc.x, npc.y, direction);
  const foreground = UI.getFutureTileID(map.foreground, npc.x, npc.y, direction);
  const walkable = UI.tileWalkable(background)
    && UI.tileWalkable(foreground, 'foreground');

  if (!walkable) {
    return false;
  }

  const vector = directionVectors[direction];
  if (!vector) {
    return false;
  }

  const targetX = npc.x + vector.x;
  const targetY = npc.y + vector.y;

  if (targetX < (npc.spawn.x - npc.range) || targetX > (npc.spawn.x + npc.range)) {
    return false;
  }

  if (targetY < (npc.spawn.y - npc.range) || targetY > (npc.spawn.y + npc.range)) {
    return false;
  }

  return true;
};

const performRandomMovement = (npc, worldRef) => {
  const nextActionAllowed = npc.lastAction + 2500;
  const now = Date.now();

  if (npc.lastAction !== 0 && nextActionAllowed >= now) {
    return false;
  }

  const action = UI.getRandomInt(1, 2) === 1 ? 'move' : 'nothing';
  let moved = false;
  let directionTaken = null;
  let blockedAttempt = false;

  if (action === 'move') {
    const directions = ['up', 'down', 'left', 'right'];
    const candidate = directions[UI.getRandomInt(0, 3)];
    directionTaken = candidate;

    if (canMove(npc, candidate, worldRef)) {
      const vector = directionVectors[candidate];
      npc.x += vector.x;
      npc.y += vector.y;
      moved = true;
    } else {
      blockedAttempt = true;
    }
  }

  const duration = moved && directionTaken ? computeStepDuration(directionTaken) : 0;
  updateMovementStep(npc, {
    startedAt: now,
    duration,
    direction: moved ? directionTaken : null,
    blocked: action === 'move' && blockedAttempt && !moved,
  });

  if (directionTaken) {
    setFacing(npc, directionTaken);
  }

  if (moved && directionTaken) {
    setAnimationState(npc, 'run', {
      direction: directionTaken,
      duration,
      startedAt: now,
    });
  } else {
    setAnimationState(npc, 'idle', {
      direction: directionTaken || npc.facing,
      startedAt: now,
    });
  }

  npc.lastAction = now;
  return true;
};

const createNpcMovementHandler = (npc) => ({
  resolveFacing: (direction, fallback) => resolveFacing(npc, direction, fallback),
  setFacing: direction => setFacing(npc, direction),
  createInitialAnimation: overrides => createInitialAnimation(npc, overrides),
  setAnimationState: (state, options) => setAnimationState(npc, state, options),
  performRandomMovement: worldRef => performRandomMovement(npc, worldRef),
});

export default createNpcMovementHandler;
export { computeStepDuration };
