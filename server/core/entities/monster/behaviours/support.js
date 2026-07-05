import { manhattanDistance } from '../movement-handler.js';
import { DEFAULT_BEHAVIOUR } from '../stats-manager.js';

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

const findWeakenedAlly = (monster) => {
  const scene = monster.activeScene;
  if (!scene || !Array.isArray(scene.monsters)) {
    return null;
  }

  const candidates = scene.monsters
    .filter((ally) => ally && ally.uuid !== monster.uuid && ally.isAlive)
    .map((ally) => {
      const health = ally.stats && ally.stats.resources ? ally.stats.resources.health : null;
      const missing = health ? (health.max - health.current) : 0;
      return { ally, missing };
    })
    .filter(entry => entry.missing > 0)
    .sort((a, b) => b.missing - a.missing);

  return candidates.length ? candidates[0].ally : null;
};

// Healing is a paced ability, not a free action: without the interval gate a
// support healed every AI tick (600ms) for more than most trash mobs' entire
// health pool — players watched their target refill mid-swing and nothing
// near a healer could ever die.
const DEFAULT_HEAL_INTERVAL_MS = 4000;
const HEAL_FRACTION_CAP = 0.3; // a single heal restores at most 30% of the ally

const applyHeal = (monster, ally, behaviour, now) => {
  if (!ally) {
    return false;
  }

  const supportConfig = behaviour.support || DEFAULT_BEHAVIOUR.support || {};
  const healRange = supportConfig.healRange || 5;
  const healAmount = supportConfig.healAmount || Math.round(monster.level * 3.5);
  const healIntervalMs = supportConfig.healIntervalMs || DEFAULT_HEAL_INTERVAL_MS;

  if (now - (monster.state.lastHealAt || 0) < healIntervalMs) {
    return 'cooldown';
  }

  if (manhattanDistance(monster, ally) > healRange) {
    return 'move';
  }

  const allyMaxHealth = (ally.stats && ally.stats.resources && ally.stats.resources.health)
    ? ally.stats.resources.health.max
    : 0;
  const cappedHeal = Math.max(1, Math.min(
    Math.floor(healAmount),
    Math.round(allyMaxHealth * HEAL_FRACTION_CAP) || 1,
  ));

  const result = ally.heal(cappedHeal, { now });
  if (result) {
    monster.state.lastHealAt = now;
    monster.setAnimationState('attack', { direction: monster.facing, duration: behaviour.attack?.windupMs || 400, startedAt: now });
    return 'healed';
  }

  return false;
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

const createSupportBehaviourSystem = (entity, monster) => (world, _delta, context = {}) => {
  const now = context.now || Date.now();
  const lifecycle = entity.getComponent('lifecycle');
  if (lifecycle) {
    lifecycle.dirty = false;
  }

  if (!monster.isAlive) {
    ensureDeathHandled(monster, entity, now);
    return;
  }

  let dirty = false;

  const behaviour = monster.behaviour || {};
  const attackConfig = behaviour.attack || {};
  const rangedPreferred = Math.max(3, attackConfig.range || 5);
  const minimumDistance = Math.max(1, attackConfig.minimumRange || 2);

  if (monster.state.pendingAttack && now >= monster.state.pendingAttack.resolveAt) {
    dirty = monster.resolvePendingAttack(now) || dirty;
  }

  const ally = findWeakenedAlly(monster);
  if (ally) {
    monster.state.mode = 'support';
    const action = applyHeal(monster, ally, behaviour, now);
    if (action === 'move') {
      dirty = monster.pursue(ally, now) || dirty;
      markDirty(entity, dirty);
      return;
    }
    if (action === 'healed') {
      markDirty(entity, true);
      return;
    }
    // Heal on cooldown: fall through and fight like everyone else instead of
    // hovering uselessly next to the wounded ally.
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

  if (distance <= rangedPreferred && distance > minimumDistance) {
    dirty = monster.tryAttack(target, now) || dirty;
    markDirty(entity, dirty);
    return;
  }

  if (distance <= minimumDistance) {
    dirty = monster.pursue(target, now) || dirty;
    if (!dirty) {
      dirty = monster.tryAttack(target, now) || dirty;
    }
    markDirty(entity, dirty);
    return;
  }

  dirty = monster.pursue(target, now) || dirty;
  markDirty(entity, dirty);
};

const registerSupportBehaviour = ({ world, entity, monster }) => {
  entity.addComponent('behaviour', { type: 'support' });
  if (!entity.hasComponent('lifecycle')) {
    entity.addComponent('lifecycle', { dirty: false });
  }
  if (!entity.hasComponent('monster')) {
    entity.addComponent('monster', { ref: monster });
  }

  const system = createSupportBehaviourSystem(entity, monster);
  world.addSystem(system);
  return system;
};

export default registerSupportBehaviour;
