const ATTRIBUTE_IDS = ['strength', 'dexterity', 'intelligence'];

const ATTRIBUTE_LABELS = {
  strength: 'Strength',
  dexterity: 'Dexterity',
  intelligence: 'Intelligence',
};

const DEFAULT_ATTRIBUTE_VALUE = 10;
const DEFAULT_ATTRIBUTE_SOURCES = ['base', 'equipment', 'bonuses', 'passives'];

const RESOURCE_RULES = {
  health: {
    base: 60,
    perLevel: 8,
    perStrength: 5,
    min: 1,
  },
  mana: {
    base: 30,
    perLevel: 3,
    perIntelligence: 6,
    min: 0,
  },
};

const DEFAULT_LIFECYCLE = {
  mode: 'soft',
  state: 'alive',
  deaths: 0,
  livesRemaining: 0,
  cheatDeath: {
    charges: 1,
    cooldownMs: 300000,
    lastTriggerAt: null,
    healthFloorFraction: 0.2,
  },
  respawn: {
    pending: false,
    at: null,
    defaultDelayMs: 10000,
    healthFraction: 0.5,
    manaFraction: 0.5,
    penaltyMultiplier: 1,
    location: null,
  },
};

function createAttributeMap(initial = 0) {
  return ATTRIBUTE_IDS.reduce((acc, key) => {
    acc[key] = initial;
    return acc;
  }, {});
}

function clone(obj) {
  if (!obj || typeof obj !== 'object') {
    return {};
  }

  if (Array.isArray(obj)) {
    return obj.map(item => clone(item));
  }

  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (value && typeof value === 'object') {
      acc[key] = clone(value);
    } else {
      acc[key] = value;
    }

    return acc;
  }, {});
}

function normaliseAttributeSource(source = {}, fallback = DEFAULT_ATTRIBUTE_VALUE) {
  const base = createAttributeMap(0);

  ATTRIBUTE_IDS.forEach((id) => {
    const value = source[id];
    if (typeof value === 'number' && Number.isFinite(value)) {
      base[id] = value;
    } else if (fallback !== undefined) {
      base[id] = fallback;
    }
  });

  return base;
}

function aggregateAttributes(sources = {}) {
  const resolved = {};

  DEFAULT_ATTRIBUTE_SOURCES.forEach((key, index) => {
    const fallback = key === 'base' ? DEFAULT_ATTRIBUTE_VALUE : 0;
    resolved[key] = normaliseAttributeSource(sources[key], fallback);

    if (index === 0 && !sources[key]) {
      resolved[key] = normaliseAttributeSource(resolved[key], DEFAULT_ATTRIBUTE_VALUE);
    }
  });

  const total = createAttributeMap(0);
  ATTRIBUTE_IDS.forEach((id) => {
    total[id] = DEFAULT_ATTRIBUTE_SOURCES.reduce((sum, key) => sum + (resolved[key][id] || 0), 0);
  });

  return {
    total,
    sources: resolved,
  };
}

function parseNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normaliseMeter(input = {}, derivedMax = 0, options = {}) {
  const { allowMinZero = false } = options;

  const current = parseNumber(input.current);
  const max = parseNumber(input.max);
  const base = parseNumber(input.base);
  const bonus = parseNumber(input.bonus);

  let resolvedMax = derivedMax;

  if (base !== null || bonus !== null) {
    const baseValue = base !== null ? base : derivedMax;
    const bonusValue = bonus !== null ? bonus : 0;
    resolvedMax = baseValue + bonusValue;
  }

  if (max !== null && max > resolvedMax) {
    resolvedMax = max;
  }

  if (!Number.isFinite(resolvedMax) || resolvedMax <= 0) {
    resolvedMax = derivedMax;
  }

  const resolvedCurrent = current !== null ? current : derivedMax;

  return {
    current: Math.max(allowMinZero ? 0 : 1, Math.min(resolvedCurrent, resolvedMax)),
    max: Math.max(allowMinZero ? 0 : 1, resolvedMax),
  };
}

function computeResourceMax(rule, context = {}) {
  const level = Number.isFinite(context.level) ? context.level : 1;
  const strength = Number.isFinite(context.strength) ? context.strength : DEFAULT_ATTRIBUTE_VALUE;
  const intelligence = Number.isFinite(context.intelligence)
    ? context.intelligence
    : DEFAULT_ATTRIBUTE_VALUE;

  const perAttribute = rule === RESOURCE_RULES.mana ? intelligence : strength;
  const perAttributeGain = rule.perStrength || rule.perIntelligence || 0;
  const perLevelGain = rule.perLevel || 0;

  const baseValue = rule.base || 0;

  const derived = baseValue + (Math.max(level - 1, 0) * perLevelGain) + (perAttribute * perAttributeGain);
  return Math.max(rule.min ?? 0, Math.round(derived));
}

function computeResources({ level = 1, attributes = {} } = {}, overrides = {}) {
  const context = {
    level,
    strength: attributes.strength,
    intelligence: attributes.intelligence,
  };

  const healthMax = computeResourceMax(RESOURCE_RULES.health, context);
  const manaMax = computeResourceMax(RESOURCE_RULES.mana, context);

  const healthSource = overrides.health || overrides.hp || {};
  const allowZeroHealth = healthSource.allowZero === true || healthSource.current === 0;
  const manaSource = overrides.mana || overrides.mp || {};

  const health = normaliseMeter(healthSource, healthMax, { allowMinZero: allowZeroHealth });
  const mana = normaliseMeter(manaSource, manaMax, { allowMinZero: true });

  if (!overrides.health && !overrides.hp) {
    health.current = health.max;
  }

  if (!overrides.mana && !overrides.mp) {
    mana.current = mana.max;
  }

  const minimumHealth = allowZeroHealth ? 0 : 1;
  health.current = Math.max(minimumHealth, Math.min(health.current, health.max));
  mana.current = Math.max(0, Math.min(mana.current, mana.max));

  return { health, mana };
}

function mergeLifecycle(overrides = {}) {
  const lifecycle = clone(DEFAULT_LIFECYCLE);

  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      lifecycle[key] = {
        ...lifecycle[key],
        ...clone(value),
      };
      return;
    }

    lifecycle[key] = value;
  });

  if (!['alive', 'awaiting-respawn', 'permadead', 'cheat-death'].includes(lifecycle.state)) {
    lifecycle.state = 'alive';
  }

  if (typeof lifecycle.livesRemaining !== 'number' || !Number.isFinite(lifecycle.livesRemaining)) {
    lifecycle.livesRemaining = DEFAULT_LIFECYCLE.livesRemaining;
  }

  return lifecycle;
}

function createCharacterState(config = {}) {
  const level = Number.isFinite(config.level) ? config.level : 1;
  const attributeSources = config.attributes || config.attributeSources || {};
  const aggregated = aggregateAttributes(attributeSources);
  const resources = computeResources({ level, attributes: aggregated.total }, config.resources || config);
  const lifecycle = mergeLifecycle(config.lifecycle || config.state);

  return {
    level,
    attributes: aggregated,
    resources,
    lifecycle,
  };
}

function syncShortcuts(state, target = {}) {
  const updated = target;
  updated.stats = state;
  updated.attributes = state.attributes;
  updated.hp = state.resources.health;
  updated.mana = state.resources.mana;
  updated.lifecycle = state.lifecycle;
  return updated;
}

function canUseCheatDeath(lifecycle, options = {}) {
  const cheat = lifecycle && lifecycle.cheatDeath;
  if (!cheat || typeof cheat.charges !== 'number' || cheat.charges <= 0) {
    return false;
  }

  if (options.allowCheatDeath === false) {
    return false;
  }

  const now = options.now || Date.now();
  const cooldownMs = Number.isFinite(cheat.cooldownMs) ? cheat.cooldownMs : 0;

  if (cheat.lastTriggerAt && now - cheat.lastTriggerAt < cooldownMs) {
    return false;
  }

  return true;
}

function triggerCheatDeath(state, options = {}) {
  const { lifecycle, resources } = state;
  const cheat = lifecycle.cheatDeath;
  const now = options.now || Date.now();
  const floorFraction = Number.isFinite(cheat.healthFloorFraction)
    ? cheat.healthFloorFraction
    : 0.2;

  const healthFloor = Math.max(1, Math.round(resources.health.max * floorFraction));
  resources.health.current = Math.max(healthFloor, options.minimumHealth || 1);
  lifecycle.state = 'cheat-death';
  lifecycle.cheatDeath.charges -= 1;
  lifecycle.cheatDeath.lastTriggerAt = now;
  lifecycle.lastEvent = {
    type: 'cheat-death',
    occurredAt: now,
  };

  return {
    type: 'cheat-death',
    timestamp: now,
    health: clone(resources.health),
    cheatDeath: clone(lifecycle.cheatDeath),
  };
}

function markDeath(state, options = {}) {
  const { lifecycle, resources } = state;
  const now = options.now || Date.now();

  lifecycle.deaths += 1;

  if (typeof lifecycle.livesRemaining === 'number' && lifecycle.livesRemaining > 0) {
    lifecycle.livesRemaining -= 1;
  }

  const hasExtraLives = typeof lifecycle.livesRemaining === 'number'
    && lifecycle.livesRemaining > 0;
  const isSoftMode = lifecycle.mode !== 'hard';
  const allowRespawn = options.allowRespawn !== undefined
    ? options.allowRespawn
    : (isSoftMode || hasExtraLives);

  resources.health.current = 0;

  const respawnDelay = Number.isFinite(options.respawnDelayMs)
    ? options.respawnDelayMs
    : lifecycle.respawn.defaultDelayMs;

  const outcome = {
    type: 'death',
    timestamp: now,
    permadeath: !allowRespawn,
  };

  if (allowRespawn) {
    lifecycle.state = 'awaiting-respawn';
    lifecycle.respawn.pending = true;
    lifecycle.respawn.at = now + Math.max(0, respawnDelay);
    lifecycle.respawn.location = options.respawnLocation || lifecycle.respawn.location || null;
    lifecycle.respawn.healthFraction = options.respawnHealthFraction
      ?? lifecycle.respawn.healthFraction
      ?? 0.5;
    lifecycle.respawn.manaFraction = options.respawnManaFraction
      ?? lifecycle.respawn.manaFraction
      ?? 0.5;
  } else {
    lifecycle.state = 'permadead';
    lifecycle.respawn.pending = false;
    lifecycle.respawn.at = null;
  }

  lifecycle.lastEvent = {
    type: allowRespawn ? 'death' : 'permadeath',
    occurredAt: now,
  };

  return outcome;
}

function applyDamage(state, amount, options = {}) {
  if (!state || !state.resources || !state.resources.health) {
    return null;
  }

  const timestamp = options.now || Date.now();
  const damage = Math.max(0, Math.floor(amount));

  if (damage <= 0) {
    return {
      type: 'damage',
      amount: 0,
      timestamp,
      health: clone(state.resources.health),
    };
  }

  state.resources.health.current = Math.max(0, state.resources.health.current - damage);

  if (state.resources.health.current > 0) {
    return {
      type: 'damage',
      amount: damage,
      timestamp,
      health: clone(state.resources.health),
    };
  }

  if (canUseCheatDeath(state.lifecycle, options)) {
    return triggerCheatDeath(state, options);
  }

  return markDeath(state, options);
}

function applyHealing(state, amount, options = {}) {
  if (!state || !state.resources || !state.resources.health) {
    return null;
  }

  const timestamp = options.now || Date.now();
  const healing = Math.max(0, Math.floor(amount));

  if (healing <= 0) {
    return {
      type: 'heal',
      amount: 0,
      timestamp,
      health: clone(state.resources.health),
    };
  }

  const health = state.resources.health;
  health.current = Math.min(health.max, health.current + healing);

  if (state.lifecycle && state.lifecycle.state === 'cheat-death' && health.current > 0) {
    state.lifecycle.state = 'alive';
  }

  return {
    type: 'heal',
    amount: healing,
    timestamp,
    health: clone(health),
  };
}

function tryRespawn(state, options = {}) {
  if (!state || !state.lifecycle || !state.resources) {
    return { success: false, reason: 'invalid-state' };
  }

  const lifecycle = state.lifecycle;
  if (lifecycle.state !== 'awaiting-respawn' || !lifecycle.respawn.pending) {
    return { success: false, reason: 'not-awaiting-respawn' };
  }

  const now = options.now || Date.now();
  const readyAt = lifecycle.respawn.at || now;

  if (!options.force && now < readyAt) {
    return { success: false, reason: 'cooldown' };
  }

  const healthFraction = options.healthFraction
    ?? lifecycle.respawn.healthFraction
    ?? 0.5;
  const manaFraction = options.manaFraction
    ?? lifecycle.respawn.manaFraction
    ?? 0.5;

  state.resources.health.current = Math.max(
    1,
    Math.round(state.resources.health.max * healthFraction),
  );

  if (state.resources.mana) {
    state.resources.mana.current = Math.round(state.resources.mana.max * manaFraction);
  }

  lifecycle.state = 'alive';
  lifecycle.respawn.pending = false;
  lifecycle.respawn.lastAt = now;
  lifecycle.lastEvent = {
    type: 'respawn',
    occurredAt: now,
  };

  return {
    success: true,
    type: 'respawn',
    timestamp: now,
    health: clone(state.resources.health),
    mana: state.resources.mana ? clone(state.resources.mana) : null,
  };
}

function getLifecycleSummary(lifecycle = {}) {
  const summary = {
    state: lifecycle.state || 'unknown',
    mode: lifecycle.mode || 'soft',
    deaths: lifecycle.deaths || 0,
    livesRemaining: lifecycle.livesRemaining ?? 0,
    cheatDeath: null,
    respawn: null,
  };

  if (lifecycle.cheatDeath) {
    summary.cheatDeath = {
      charges: lifecycle.cheatDeath.charges ?? 0,
      cooldownMs: lifecycle.cheatDeath.cooldownMs ?? 0,
      lastTriggerAt: lifecycle.cheatDeath.lastTriggerAt || null,
    };
  }

  if (lifecycle.respawn) {
    summary.respawn = {
      pending: Boolean(lifecycle.respawn.pending),
      at: lifecycle.respawn.at || null,
      defaultDelayMs: lifecycle.respawn.defaultDelayMs ?? DEFAULT_LIFECYCLE.respawn.defaultDelayMs,
    };
  }

  return summary;
}

function toClientPayload(state = {}) {
  return {
    level: state.level,
    attributes: clone(state.attributes),
    resources: clone(state.resources),
    lifecycle: clone(state.lifecycle),
  };
}

export {
  ATTRIBUTE_IDS,
  ATTRIBUTE_LABELS,
  createAttributeMap,
  aggregateAttributes,
  computeResources,
  createCharacterState,
  applyDamage,
  applyHealing,
  tryRespawn,
  markDeath,
  syncShortcuts,
  getLifecycleSummary,
  toClientPayload,
};

export default {
  ATTRIBUTE_IDS,
  ATTRIBUTE_LABELS,
  createAttributeMap,
  aggregateAttributes,
  computeResources,
  createCharacterState,
  applyDamage,
  applyHealing,
  tryRespawn,
  markDeath,
  syncShortcuts,
  getLifecycleSummary,
  toClientPayload,
};
