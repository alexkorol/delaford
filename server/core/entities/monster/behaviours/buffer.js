import { manhattanDistance } from '../movement-handler.js';
import registerRangedBehaviour from './ranged.js';

const applyAura = (monster, now) => {
  const scene = monster.activeScene;
  const config = monster.behaviour.aura || {};
  const radius = Math.max(1, Number(config.radius) || 5);
  const damageMultiplier = Math.max(1, Number(config.damageMultiplier) || 1.12);
  const durationMs = Math.max(1000, Number(config.durationMs) || 2200);
  // Dormant instances remain registered for return trips. Do no aura work in
  // empty scenes or old floors accumulate needless dirty broadcasts.
  if (!scene?.monsters || !scene.players?.length) return false;

  let changed = false;
  scene.monsters.forEach((ally) => {
    if (!ally?.isAlive || ally.uuid === monster.uuid || manhattanDistance(monster, ally) > radius) return;
    ally.state.effects = ally.state.effects || {};
    ally.state.effects[`aura:${monster.uuid}`] = {
      sourceId: monster.uuid,
      label: 'Empowered',
      damageMultiplier,
      expiresAt: now + durationMs,
    };
    changed = true;
  });
  monster.state.lastAuraAt = now;
  return changed;
};

const registerBufferBehaviour = (args) => {
  const { world, entity, monster } = args;
  registerRangedBehaviour(args);
  entity.addComponent('behaviour', { type: 'buffer' });
  world.addSystem((_ecs, _delta, context = {}) => {
    const now = context.now || Date.now();
    const intervalMs = Math.max(1000, Number(monster.behaviour.aura?.intervalMs) || 1500);
    if (!monster.isAlive || now - (monster.state.lastAuraAt || 0) < intervalMs) return;
    if (applyAura(monster, now)) {
      const lifecycle = entity.getComponent('lifecycle');
      if (lifecycle) lifecycle.dirty = true;
    }
  });
};

export { applyAura };
export default registerBufferBehaviour;
