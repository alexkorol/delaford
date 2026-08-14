export default {
  'monster:state': (message, context) => {
    if (!context || typeof context.monsterState !== 'function') {
      return;
    }

    const payload = message && message.data ? message.data : [];
    const meta = message && message.meta ? message.meta : {};
    context.monsterState(payload, meta);
  },
  'combat:hit': (message, context) => {
    if (!context || typeof context.combatHit !== 'function') {
      return;
    }

    context.combatHit(message && message.data ? message.data : {});
  },
  'world:projectile': (message, context) => {
    const map = context && context.game && context.game.map;
    if (map && typeof map.addProjectile === 'function') {
      map.addProjectile(message && message.data ? message.data : {});
    }
  },
  'world:skill:effect': (message, context) => {
    const map = context && context.game && context.game.map;
    if (map && typeof map.addSkillEffect === 'function') {
      map.addSkillEffect(message && message.data ? message.data : {});
    }
  },
  'monster:telegraph': (message, context) => {
    const map = context && context.game && context.game.map;
    if (map && typeof map.addGroundTelegraph === 'function') {
      map.addGroundTelegraph(message && message.data ? message.data : {});
    }
  },
};
