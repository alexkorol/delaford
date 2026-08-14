import { euclideanDistance } from '../movement-handler.js';

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

const ensureRespawn = (monster, now) => {
  if (monster.state.respawnAt && now < monster.state.respawnAt) {
    return false;
  }
  monster.respawnNow(now);
  return true;
};

const handleDeathState = (monster, entity, now) => {
  if (!monster.state.respawnAt) {
    monster.state.respawnAt = now + monster.respawn.delayMs;
    return markDirty(entity, true);
  }

  if (now >= monster.state.respawnAt) {
    return markDirty(entity, ensureRespawn(monster, now));
  }

  return false;
};

const createMeleeBehaviourSystem = (entity, monster) => (world, _delta, context = {}) => {
  const now = context.now || Date.now();
  const lifecycle = entity.getComponent('lifecycle');
  if (lifecycle) {
    lifecycle.dirty = false;
  }

  if (!monster.isAlive) {
    handleDeathState(monster, entity, now);
    return;
  }

  let dirty = false;

  if (monster.state.pendingAttack && now >= monster.state.pendingAttack.resolveAt) {
    dirty = monster.resolvePendingAttack(now) || dirty;
  }

  // Ground-slam danger is anchored where it was telegraphed. The boss must
  // commit to that circle instead of sliding after a player during the windup.
  if (monster.state.pendingAttack?.skillId === 'boss:ground-slam') {
    markDirty(entity, dirty);
    return;
  }

  const target = monster.resolveTarget(now);
  if (target) {
    monster.state.mode = 'engaged';
    // Continuous positions: melee reach is a radius, not tile adjacency.
    // Pursuit stops ~1 tile out, so 1.6 covers the diagonal standoff.
    const distance = euclideanDistance(monster, target);
    if (distance <= 1.6) {
      dirty = monster.tryAttack(target, now) || dirty;
    } else {
      dirty = monster.pursue(target, now) || dirty;
    }
    markDirty(entity, dirty);
    return;
  }

  // Only trek home when genuinely far afield (chased a player off the
  // patrol ground). The old >0.5 gate yanked monsters back after every
  // wander step — the "slide one cell and snap back" tic.
  const patrolRadius = (monster.behaviour && monster.behaviour.patrolRadius) || 0;
  const distanceFromSpawn = euclideanDistance(monster, monster.spawn);
  if (distanceFromSpawn > patrolRadius + 1.5) {
    monster.state.mode = 'returning';
    dirty = monster.returnToSpawn(now) || dirty;
    markDirty(entity, dirty);
    return;
  }

  monster.state.mode = 'patrolling';
  dirty = monster.patrol(now) || dirty;
  markDirty(entity, dirty);
};

const registerMeleeBehaviour = ({ world, entity, monster }) => {
  entity.addComponent('behaviour', { type: 'melee' });
  if (!entity.hasComponent('lifecycle')) {
    entity.addComponent('lifecycle', { dirty: false });
  }
  if (!entity.hasComponent('monster')) {
    entity.addComponent('monster', { ref: monster });
  }

  const system = createMeleeBehaviourSystem(entity, monster);
  world.addSystem(system);
  return system;
};

export default registerMeleeBehaviour;
