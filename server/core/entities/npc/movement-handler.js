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

// ── Continuous ambling ─────────────────────────────────────────────────
//
// The old behaviour hopped exactly one random cell every ~2.5s — smooth
// tween, robotic decision. NPCs now amble to a point inside their range at
// walking pace, pause like a person would, and amble on. Positions are
// floats; the client interpolates position→position over the duration.

const NPC_AMBLE_SPEED = 1.1; // tiles/sec — an unhurried villager
const NPC_SAMPLE_TILES = 0.3;
const NPC_MAX_DT_MS = 2000;

const tileOpenForNpc = (npc, worldRef, x, y) => {
  const map = worldRef.map;
  if (!map || !Array.isArray(map.background) || !Array.isArray(map.foreground)) {
    return false;
  }

  const tileX = Math.round(x);
  const tileY = Math.round(y);
  if (tileX < (npc.spawn.x - npc.range) || tileX > (npc.spawn.x + npc.range)
    || tileY < (npc.spawn.y - npc.range) || tileY > (npc.spawn.y + npc.range)) {
    return false;
  }

  const width = Math.sqrt(map.background.length) | 0;
  const index = (tileY * width) + tileX;
  return UI.tileWalkable(map.background[index] - 1)
    && UI.tileWalkable(map.foreground[index] - 1, 'foreground');
};

const pickAmbleTarget = (npc, worldRef) => {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const angle = (UI.getRandomInt(0, 359) * Math.PI) / 180;
    const distance = UI.getRandomInt(10, Math.max(10, npc.range * 10)) / 10;
    const x = npc.spawn.x + (Math.cos(angle) * distance);
    const y = npc.spawn.y + (Math.sin(angle) * distance);
    if (tileOpenForNpc(npc, worldRef, x, y)) {
      return { x, y };
    }
  }
  return null;
};

const performRandomMovement = (npc, worldRef) => {
  const now = Date.now();
  const dtRaw = now - (npc.lastGlideAt || now);
  npc.lastGlideAt = now;
  const dt = Math.max(0, Math.min(dtRaw, NPC_MAX_DT_MS));

  // Pausing between strolls.
  if ((npc.ambleDwellUntil || 0) > now) {
    return false;
  }

  if (!npc.ambleTarget) {
    npc.ambleTarget = pickAmbleTarget(npc, worldRef);
    if (!npc.ambleTarget) {
      npc.ambleDwellUntil = now + 2000;
      return false;
    }
  }

  const dx = npc.ambleTarget.x - npc.x;
  const dy = npc.ambleTarget.y - npc.y;
  const remaining = Math.sqrt((dx * dx) + (dy * dy));

  if (remaining <= 0.25 || dt === 0) {
    if (remaining <= 0.25) {
      npc.ambleTarget = null;
      npc.ambleDwellUntil = now + 1500 + UI.getRandomInt(0, 4500);
      setAnimationState(npc, 'idle', { direction: npc.facing, startedAt: now });
      updateMovementStep(npc, {
        startedAt: now, duration: 0, direction: null, blocked: false,
      });
    }
    return false;
  }

  const travel = Math.min((NPC_AMBLE_SPEED * dt) / 1000, remaining);
  const ux = dx / remaining;
  const uy = dy / remaining;

  // Collision-sample the path; stop at the last open spot.
  const samples = Math.max(1, Math.ceil(travel / NPC_SAMPLE_TILES));
  let reached = 0;
  for (let i = 1; i <= samples; i += 1) {
    const at = (travel * i) / samples;
    if (!tileOpenForNpc(npc, worldRef, npc.x + (ux * at), npc.y + (uy * at))) {
      break;
    }
    reached = at;
  }

  if (reached <= 0.01) {
    npc.ambleTarget = null;
    npc.ambleDwellUntil = now + 1200;
    updateMovementStep(npc, {
      startedAt: now, duration: 0, direction: null, blocked: true,
    });
    setAnimationState(npc, 'idle', { direction: npc.facing, startedAt: now });
    return false;
  }

  npc.x += ux * reached;
  npc.y += uy * reached;

  const direction = Math.abs(ux) > Math.abs(uy)
    ? (ux > 0 ? 'right' : 'left')
    : (uy > 0 ? 'down' : 'up');
  const duration = Math.max(90, Math.round(dt));

  updateMovementStep(npc, {
    startedAt: now, duration, direction, blocked: false,
  });
  setFacing(npc, direction);
  setAnimationState(npc, 'run', { direction, duration, startedAt: now });

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
