import { manhattanDistance } from '../movement-handler.js';

const markDirty = (entity, dirty) => {
  if (!dirty) {
    return false;
  }
  const lifecycle = entity.getComponent('lifecycle');
  if (lifecycle) {
    lifecycle.dirty = true;
  }
  return true;
};

// Kite away smoothly (continuous positions) instead of hopping one cell.
const attemptRetreat = (monster, target, now) => {
  if (!target) {
    return false;
  }

  return monster.retreatFrom(target, now);
};

const ensureDeathHandled = (monster, entity, now) => {
  if (!monster.state.respawnAt) {
    monster.state.respawnAt = now + monster.respawn.delayMs;
    return markDirty(entity, true);
  }
  if (now >= monster.state.respawnAt) {
    monster.respawnNow(now);
    return markDirty(entity, true);
  }
  return false;
};

const createRangedBehaviourSystem = (entity, monster) => (world, _delta, context = {}) => {
  const now = context.now || Date.now();
  const lifecycle = entity.getComponent('lifecycle');
  if (lifecycle) {
    lifecycle.dirty = false;
  }

  if (!monster.isAlive) {
    ensureDeathHandled(monster, entity, now);
    return;
  }

  const behaviour = monster.behaviour || {};
  const attackConfig = behaviour.attack || {};
  const preferredRange = Math.max(2, attackConfig.range || 4);
  const minimumDistance = Math.max(1, attackConfig.minimumRange || 2);

  let dirty = false;

  if (monster.state.pendingAttack && now >= monster.state.pendingAttack.resolveAt) {
    dirty = monster.resolvePendingAttack(now) || dirty;
  }

  const target = monster.resolveTarget(now);
  if (!target) {
    monster.state.mode = 'patrolling';
    dirty = monster.patrol(now) || dirty;
    markDirty(entity, dirty);
    return;
  }

  monster.state.mode = 'engaged';
  const distance = manhattanDistance(monster, target);

  if (distance <= preferredRange && distance > minimumDistance) {
    dirty = monster.tryAttack(target, now) || dirty;
    markDirty(entity, dirty);
    return;
  }

  if (distance <= minimumDistance - 0.5) {
    // Hysteresis: only kite away once genuinely crowded, so the archer does
    // not metronome across the minimum-range boundary every tick.
    const retreated = attemptRetreat(monster, target, now);
    dirty = retreated || dirty;
    if (!retreated) {
      dirty = monster.tryAttack(target, now) || dirty;
    }
    markDirty(entity, dirty);
    return;
  }

  if (distance <= minimumDistance) {
    dirty = monster.tryAttack(target, now) || dirty;
    markDirty(entity, dirty);
    return;
  }

  dirty = monster.pursue(target, now) || dirty;
  markDirty(entity, dirty);
};

const registerRangedBehaviour = ({ world, entity, monster }) => {
  entity.addComponent('behaviour', { type: 'ranged' });
  if (!entity.hasComponent('lifecycle')) {
    entity.addComponent('lifecycle', { dirty: false });
  }
  if (!entity.hasComponent('monster')) {
    entity.addComponent('monster', { ref: monster });
  }

  const system = createRangedBehaviourSystem(entity, monster);
  world.addSystem(system);
  return system;
};

export default registerRangedBehaviour;
