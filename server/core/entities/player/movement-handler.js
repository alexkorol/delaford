import MapUtils from '#shared/map-utils.js';
import Socket from '#server/socket.js';
import UI from '#shared/ui.js';
import config from '#server/config.js';
import playerEvent from '#server/player/handlers/actions/index.js';
import world from '#server/core/world.js';
import { transitionPlayerIfOnPortal } from '#server/core/world-transitions.js';
import {
  DEFAULT_FACING_DIRECTION,
  DEFAULT_ANIMATION_DURATIONS,
  DEFAULT_ANIMATION_HOLDS,
} from '#shared/combat.js';

export const BASE_MOVE_DURATION = 150;

export const computeStepDuration = (deltaX, deltaY, baseDuration = BASE_MOVE_DURATION) => {
  const diagonal = Math.abs(deltaX) === 1 && Math.abs(deltaY) === 1;
  const multiplier = diagonal ? Math.SQRT2 : 1;
  return Math.round(baseDuration * multiplier);
};

export const directionDelta = (direction) => {
  const mapping = {
    right: { x: 1, y: 0 },
    left: { x: -1, y: 0 },
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    'up-right': { x: 1, y: -1 },
    'down-right': { x: 1, y: 1 },
    'up-left': { x: -1, y: -1 },
    'down-left': { x: -1, y: 1 },
  };

  return mapping[direction] || null;
};

const resolveFacing = (direction, fallback = DEFAULT_FACING_DIRECTION) => {
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

const setFacing = (player, direction) => {
  player.facing = resolveFacing(direction, player.facing || DEFAULT_FACING_DIRECTION);
  return player.facing;
};

const clearAnimationTimer = (player) => {
  if (player.animationTimer) {
    clearTimeout(player.animationTimer);
    player.animationTimer = null;
  }
};

export const broadcastMovement = (player, players = null) => {
  if (!player) {
    return;
  }

  const meta = {};
  if (player.movementStep) {
    meta.movementStep = player.movementStep;
  }
  if (player.animation) {
    meta.animation = player.animation;
  }
  const recipients = players || world.getScenePlayers(player.sceneId);
  Socket.broadcast('player:movement', player, recipients, { meta });
};

export const broadcastAnimation = (player, players = null) => {
  if (!player || !player.animation) {
    return;
  }

  const recipients = players || world.getScenePlayers(player.sceneId);
  Socket.broadcast('player:animation', {
    playerId: player.uuid,
    animation: player.animation,
  }, recipients);
};

const createInitialAnimation = (player, overrides = {}) => {
  const direction = resolveFacing(overrides.direction, DEFAULT_FACING_DIRECTION);
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

const setAnimationState = (player, state, options = {}) => {
  const resolvedState = state || 'idle';
  const direction = resolveFacing(options.direction, player.facing || DEFAULT_FACING_DIRECTION);
  const nowTs = Number.isFinite(options.startedAt) ? options.startedAt : Date.now();
  const previousSequence = player.animation && typeof player.animation.sequence === 'number'
    ? player.animation.sequence
    : 0;
  const sequence = Number.isFinite(options.sequence) ? options.sequence : previousSequence + 1;
  const duration = Number.isFinite(options.duration)
    ? options.duration
    : (DEFAULT_ANIMATION_DURATIONS[resolvedState] || 0);
  const holdState = options.holdState !== undefined
    ? options.holdState
    : (DEFAULT_ANIMATION_HOLDS[resolvedState] || null);

  player.animation = {
    state: resolvedState,
    direction,
    sequence,
    startedAt: nowTs,
    duration,
    speed: Number.isFinite(options.speed) ? options.speed : 1,
    skillId: options.skillId || null,
    holdState,
  };

  clearAnimationTimer(player);

  if (holdState && duration > 0 && options.autoHold !== false) {
    player.animationTimer = setTimeout(() => {
      if (!player.animation || player.animation.sequence !== sequence) {
        return;
      }

      setAnimationState(player, holdState, {
        direction,
        sequence: sequence + 0.1,
        startedAt: Date.now(),
        duration: DEFAULT_ANIMATION_DURATIONS[holdState] || 0,
        holdState: DEFAULT_ANIMATION_HOLDS[holdState] || null,
        autoHold: false,
      });
      broadcastAnimation(player);
    }, duration);
  }

  return player.animation;
};

const registerMovementStep = (player, step = {}) => {
  const currentSequence = player.movementStep && typeof player.movementStep.sequence === 'number'
    ? player.movementStep.sequence
    : 0;

  const interruption = step.interrupted !== undefined
    ? step.interrupted
    : Boolean(player.path && player.path.current && player.path.current.interrupted);

  player.movementStep = {
    sequence: currentSequence + 1,
    startedAt: typeof step.startedAt === 'number' ? step.startedAt : Date.now(),
    duration: typeof step.duration === 'number' ? step.duration : 0,
    walkId: step.walkId ?? null,
    stepIndex: step.stepIndex ?? null,
    steps: step.steps ?? null,
    direction: step.direction || null,
    blocked: Boolean(step.blocked),
    interrupted: interruption,
  };

  return player.movementStep;
};

const cancelPathfinding = (player) => {
  const { path } = player;
  if (!path || !path.current) {
    return;
  }

  if (typeof path.current.walkId === 'number') {
    path.current.walkId += 1;
  } else {
    path.current.walkId = 1;
  }

  path.current.path.walking = [];
  path.current.path.set = [];
  path.current.length = 0;
  path.current.step = 0;
  path.current.walkable = false;
  path.current.interrupted = true;

  player.moving = false;
  player.queue = [];
  player.action = false;
  setAnimationState(player, 'idle', { direction: player.facing });
};

const hasBlockingHealth = (actor) => {
  const current = actor && actor.stats && actor.stats.resources
    && actor.stats.resources.health
    && actor.stats.resources.health.current;

  return !Number.isFinite(current) || current > 0;
};

const hasLivingMonsterAt = (player, tileX, tileY) => {
  const scene = world.getSceneForPlayer(player);
  const monsters = scene && Array.isArray(scene.monsters) ? scene.monsters : [];

  // Monsters hold continuous positions; they block the tile they stand on.
  return monsters.some(monster => monster
    && Math.round(monster.x) === tileX
    && Math.round(monster.y) === tileY
    && monster.isAlive !== false
    && hasBlockingHealth(monster));
};

const canMoveTo = (player, tileX, tileY) => {
  const { size } = config.map;

  if (tileX < 0 || tileY < 0 || tileX >= size.x || tileY >= size.y) {
    return false;
  }

  if (hasLivingMonsterAt(player, tileX, tileY)) {
    return false;
  }

  const tileIndex = (tileY * size.x) + tileX;
  const scene = world.getSceneForPlayer(player);
  const mapLayers = scene && scene.map ? scene.map : world.map;
  const steppedOn = {
    background: mapLayers.background[tileIndex] - 1,
    foreground: mapLayers.foreground[tileIndex] - 1,
  };

  const tiles = {
    background: steppedOn.background,
    foreground: steppedOn.foreground,
  };

  return MapUtils.gridWalkable(tiles, player, tileIndex, 0, 0, mapLayers) === 0;
};

const isBlocked = (player, direction, delta = null) => {
  const vector = delta || directionDelta(direction);

  if (!vector) {
    return true;
  }

  const targetX = player.x + vector.x;
  const targetY = player.y + vector.y;

  if (!canMoveTo(player, targetX, targetY)) {
    return true;
  }

  if (vector.x !== 0 && vector.y !== 0) {
    const horizontal = canMoveTo(player, player.x + vector.x, player.y);
    const vertical = canMoveTo(player, player.x, player.y + vector.y);

    if (!horizontal && !vertical) {
      return true;
    }
  }

  return false;
};

const backgroundBlocked = player => player.blocked.background === true;
const foregroundBlocked = player => player.blocked.foreground === true;

const stopMovement = (player, data) => {
  Socket.emit('player:stopped', { player: data.player });
  player.moving = false;
  setAnimationState(player, 'idle', { direction: player.facing });
  broadcastAnimation(player);
};

const resolvePlayerReference = (reference) => {
  if (reference && typeof reference === 'object') {
    return reference;
  }
  if (typeof reference === 'string') {
    return world.players.find(player => (
      player.uuid === reference || player.socket_id === reference
    )) || null;
  }
  return Number.isInteger(reference) ? world.players[reference] || null : null;
};

export const queueEmpty = (playerReference) => {
  const playerAtIndex = resolvePlayerReference(playerReference);

  if (!playerAtIndex || !Array.isArray(playerAtIndex.queue)) {
    return true;
  }

  return playerAtIndex.queue.length === 0;
};

const move = (player, direction, options = {}) => {
  const context = typeof options === 'boolean' ? { pathfind: options } : options;
  const {
    pathfind = false,
    duration: durationOverride = null,
    walkId = null,
    stepIndex = null,
    steps = null,
    startedAt = Date.now(),
  } = context || {};

  if (!pathfind) {
    cancelPathfinding(player);
  }

  if (pathfind) {
    player.moving = true;
  }

  const delta = directionDelta(direction);
  const facing = setFacing(player, direction);

  if (!delta) {
    return false;
  }

  const attemptedWalkId = pathfind ? walkId : null;
  const duration = typeof durationOverride === 'number'
    ? durationOverride
    : computeStepDuration(delta.x, delta.y);

  if (isBlocked(player, direction, delta)) {
    registerMovementStep(player, {
      duration: 0,
      walkId: attemptedWalkId,
      stepIndex,
      steps,
      startedAt,
      direction,
      blocked: true,
    });
    setAnimationState(player, 'idle', { direction: facing });
    return false;
  }

  player.x += delta.x;
  player.y += delta.y;

  registerMovementStep(player, {
    duration,
    walkId: attemptedWalkId,
    stepIndex,
    steps,
    startedAt,
    direction,
    blocked: false,
  });
  setAnimationState(player, 'run', { direction: facing, duration });
  transitionPlayerIfOnPortal(player);

  return true;
};

const walkPath = (player) => {
  const { path } = player;
  const baseSpeed = BASE_MOVE_DURATION;

  const isCurrentSession = () => world.players.some(candidate => (
    candidate === player
    && candidate.uuid === player.uuid
    && candidate.socket_id === player.socket_id
  ));

  const executeQueuedAction = () => {
    if (queueEmpty(player)) {
      return;
    }

    const todo = player.queue[0];
    const handler = todo && todo.action ? playerEvent[todo.action.actionId] : null;
    if (typeof handler === 'function') {
      const result = handler({
        todo,
        playerUuid: player.uuid,
        socketId: player.socket_id,
      });
      if (result && typeof result.catch === 'function') {
        result.catch(error => console.error('[movement] Queued action failed:', error));
      }
    }
    player.queue.shift();
  };

  if (!path || !path.current || !Array.isArray(path.current.path.walking)) {
    return;
  }

  if (path.current.path.walking.length <= 1) {
    executeQueuedAction();

    stopMovement(player, { player: { socket_id: player.socket_id } });
    return;
  }

  path.current.walkId = (path.current.walkId || 0) + 1;
  const activeWalkId = path.current.walkId;
  path.current.interrupted = false;

  const scheduleNextStep = () => {
    if (!isCurrentSession()) {
      return;
    }

    if (path.current.walkId !== activeWalkId) {
      return;
    }

    if (path.current.step + 1 >= path.current.path.walking.length) {
      executeQueuedAction();

      stopMovement(player, { player: { socket_id: player.socket_id } });
      return;
    }

    const currentIndex = path.current.step;
    const currentCoordinates = {
      x: path.current.path.walking[currentIndex][0],
      y: path.current.path.walking[currentIndex][1],
    };
    const nextCoordinates = {
      x: path.current.path.walking[currentIndex + 1][0],
      y: path.current.path.walking[currentIndex + 1][1],
    };

    const movement = UI.getMovementDirection({
      current: currentCoordinates,
      next: nextCoordinates,
    });

    const deltaX = Math.abs(nextCoordinates.x - currentCoordinates.x);
    const deltaY = Math.abs(nextCoordinates.y - currentCoordinates.y);
    const stepDuration = computeStepDuration(deltaX, deltaY, baseSpeed);
    const totalSteps = Math.max(0, path.current.path.walking.length - 1);

    setTimeout(() => {
      if (!isCurrentSession()) {
        return;
      }

      if (path.current.walkId !== activeWalkId) {
        return;
      }

      const stepStartedAt = Date.now();
      move(player, movement, {
        pathfind: true,
        duration: stepDuration,
        walkId: activeWalkId,
        stepIndex: currentIndex + 1,
        steps: totalSteps,
        startedAt: stepStartedAt,
        direction: movement,
      });

      broadcastMovement(player);

      if (player.movementStep && player.movementStep.blocked) {
        path.current.interrupted = true;
        path.current.path.walking = [];
        path.current.path.set = [];
        path.current.length = 0;
        path.current.walkable = false;
        player.moving = false;
        return;
      }

      path.current.step += 1;
      scheduleNextStep();
    }, stepDuration);
  };

  scheduleNextStep();
};

const createPlayerMovementHandler = (player) => ({
  resolveFacing: (direction, fallback = player.facing || DEFAULT_FACING_DIRECTION) => (
    resolveFacing(direction, fallback)
  ),
  setFacing: direction => setFacing(player, direction),
  clearAnimationTimer: () => clearAnimationTimer(player),
  createInitialAnimation: overrides => createInitialAnimation(player, overrides),
  setAnimationState: (state, options) => setAnimationState(player, state, options),
  registerMovementStep: step => registerMovementStep(player, step),
  cancelPathfinding: () => cancelPathfinding(player),
  canMoveTo: (tileX, tileY) => canMoveTo(player, tileX, tileY),
  isBlocked: (direction, delta) => isBlocked(player, direction, delta),
  backgroundBlocked: () => backgroundBlocked(player),
  foregroundBlocked: () => foregroundBlocked(player),
  stopMovement: data => stopMovement(player, data),
  move: (direction, options) => move(player, direction, options),
  walkPath: () => walkPath(player),
});

export default createPlayerMovementHandler;
