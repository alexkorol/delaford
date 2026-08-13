import Socket from '#server/socket.js';
import world from '#server/core/world.js';
import {
  ATTRIBUTE_IDS,
  createAttributeMap,
  createCharacterState,
  aggregateAttributes,
  computeResources,
  applyDamage as applyStatDamage,
  applyHealing as applyStatHealing,
  tryRespawn as tryStatRespawn,
  syncShortcuts,
  toClientPayload as statsToClientPayload,
} from '#shared/stats/index.js';
import { computeFlowerStatBonuses } from '#shared/passives/flower-of-life.js';
import playerPersistenceService from '#server/core/services/player-persistence.js';

const clone = (value) => {
  if (!value || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(clone);
  }

  return Object.entries(value).reduce((acc, [key, entry]) => {
    acc[key] = clone(entry);
    return acc;
  }, {});
};

const normaliseAttributeValues = (source = {}) => {
  if (!source || typeof source !== 'object') {
    return null;
  }

  const map = createAttributeMap(0);
  let hasFinite = false;

  ATTRIBUTE_IDS.forEach((attributeId) => {
    const value = Number(source[attributeId]);
    if (Number.isFinite(value)) {
      map[attributeId] = value;
      hasFinite = true;
    }
  });

  return hasFinite ? map : null;
};

const extractAttributeSource = (candidate) => {
  if (!candidate) {
    return null;
  }

  if (typeof candidate === 'object' && !Array.isArray(candidate)) {
    if (candidate.attributes && typeof candidate.attributes === 'object') {
      const nested = normaliseAttributeValues(candidate.attributes);
      if (nested) {
        return nested;
      }
    }

    const direct = normaliseAttributeValues(candidate);
    if (direct) {
      return direct;
    }
  }

  if (Array.isArray(candidate) || candidate instanceof Set || typeof candidate === 'object') {
    const { attributes } = computeFlowerStatBonuses(candidate);
    if (attributes) {
      return attributes;
    }
  }

  return null;
};

const resolveFlowerPassiveAttributes = (player, data = {}, overrides = {}) => {
  const candidates = [
    overrides.passiveAttributes,
    overrides.passives,
    overrides.flowerOfLife,
    overrides.flowerOfLifeProgress,
    overrides.progress && overrides.progress.flowerOfLife,
    data.attributes && data.attributes.passives,
    data.passives && data.passives.attributes,
    data.passives && data.passives.flowerOfLife,
    data.flowerOfLife,
    player.stats && player.stats.attributes && player.stats.attributes.sources && player.stats.attributes.sources.passives,
    player.passives && player.passives.attributes,
    player.passives && player.passives.flowerOfLife,
    player.progression && player.progression.passives && player.progression.passives.flowerOfLife,
    player.progress && player.progress.passives && player.progress.passives.flowerOfLife,
  ];

  for (const candidate of candidates) {
    const resolved = extractAttributeSource(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return createAttributeMap(0);
};

const getEquipmentAttributeTotals = (player) => {
  const totals = createAttributeMap(0);

  if (!player.wear) {
    return totals;
  }

  Object.values(player.wear).forEach((item) => {
    if (!item || !item.attributes) {
      return;
    }

    ATTRIBUTE_IDS.forEach((attributeId) => {
      const value = Number(item.attributes[attributeId]);
      if (Number.isFinite(value)) {
        totals[attributeId] += value;
      }
    });
  });

  return totals;
};

const buildInitialStats = (player, data = {}) => {
  const attributeSources = {
    base: data.attributes && data.attributes.base
      ? data.attributes.base
      : data.baseAttributes,
    bonuses: data.attributes && data.attributes.bonuses
      ? data.attributes.bonuses
      : data.attributeBonuses,
    equipment: data.attributes && data.attributes.equipment
      ? data.attributes.equipment
      : data.equipmentAttributes,
    passives: resolveFlowerPassiveAttributes(player, data),
  };

  const resourceOverrides = {
    health: (data.resources && data.resources.health) || data.hp || {},
    mana: (data.resources && data.resources.mana) || data.mana || {},
  };

  const lifecycle = data.lifecycle || {};

  player.stats = createCharacterState({
    level: player.level,
    attributes: attributeSources,
    resources: resourceOverrides,
    lifecycle,
  });

  syncShortcuts(player.stats, player);
  return player.stats;
};

const refreshDerivedStats = (player, overrides = {}) => {
  if (!player.stats) {
    buildInitialStats(player, {});
  }

  const existingSources = (player.stats && player.stats.attributes && player.stats.attributes.sources) || {};

  const baseSource = overrides.base || existingSources.base || {};
  const bonusSource = overrides.bonuses || existingSources.bonuses || {};
  const equipmentSource = overrides.equipment || getEquipmentAttributeTotals(player);
  const passiveSource = resolveFlowerPassiveAttributes(
    player,
    { passives: { attributes: existingSources.passives } },
    overrides,
  );

  const aggregated = aggregateAttributes({
    base: baseSource,
    bonuses: bonusSource,
    equipment: equipmentSource,
    passives: passiveSource,
  });

  const healthOverride = {
    current: player.hp && player.hp.current !== undefined ? player.hp.current : undefined,
  };
  if (healthOverride.current === 0) {
    healthOverride.allowZero = true;
  }

  const manaOverride = {
    current: player.mana && player.mana.current !== undefined ? player.mana.current : undefined,
  };

  const resources = computeResources(
    { level: player.level, attributes: aggregated.total },
    { health: healthOverride, mana: manaOverride },
  );

  player.stats.level = player.level;
  player.stats.attributes = aggregated;
  player.stats.resources = resources;

  syncShortcuts(player.stats, player);
  return player.stats;
};

const applyDamage = (player, amount, options = {}) => {
  if (!player.stats) {
    buildInitialStats(player, {});
  }

  const result = applyStatDamage(player.stats, amount, options);
  syncShortcuts(player.stats, player);

  // Death cancels any in-flight walk immediately — the corpse must not keep
  // striding its old path, and nothing may resume it after respawn.
  if (result && (result.type === 'death' || result.type === 'permadeath')
    && typeof player.cancelPathfinding === 'function') {
    player.cancelPathfinding();
  }

  // Hard-mode final death is an identity boundary, not an ordinary autosave
  // candidate. Persist it immediately so reconnecting before the client opens
  // the crypt cannot resurrect the fallen Scion.
  if (result && (result.permadeath === true
    || (player.stats.lifecycle && player.stats.lifecycle.state === 'permadead'))) {
    playerPersistenceService.savePlayer(player, { force: true }).catch(() => {});
  }

  return result;
};

const applyHealing = (player, amount, options = {}) => {
  if (!player.stats) {
    buildInitialStats(player, {});
  }

  const result = applyStatHealing(player.stats, amount, options);
  syncShortcuts(player.stats, player);
  return result;
};

const tryRespawn = (player, options = {}) => {
  if (!player.stats) {
    buildInitialStats(player, {});
  }

  const result = tryStatRespawn(player.stats, options);
  syncShortcuts(player.stats, player);

  // On a real respawn, drop any walking path/queue carried over from before
  // death. The previous manual cleanup wrote to path.current.walking — but
  // the real arrays live at path.current.path.walking and the walk loop is
  // keyed on walkId, so it never actually stopped anything (the reborn
  // character strode off on its stale route). cancelPathfinding does all of
  // it correctly: bumps walkId, clears the step arrays, empties the queue.
  if (result && result.success && typeof player.cancelPathfinding === 'function') {
    player.cancelPathfinding();
  }

  return result;
};

export const broadcastStats = (player, players = null) => {
  if (!player || !player.stats) {
    return;
  }

  const recipients = players || world.getScenePlayers(player.sceneId);
  const payload = {
    playerId: player.uuid,
    stats: statsToClientPayload(player.stats),
    resources: {
      health: clone(player.stats.resources.health),
      mana: clone(player.stats.resources.mana),
    },
    lifecycle: clone(player.stats.lifecycle),
  };

  Socket.broadcast('player:stats:update', payload, recipients);
};

const createPlayerStatsManager = (player) => ({
  buildInitialStats: data => buildInitialStats(player, data),
  refreshDerivedStats: overrides => refreshDerivedStats(player, overrides),
  applyDamage: (amount, options) => applyDamage(player, amount, options),
  applyHealing: (amount, options) => applyHealing(player, amount, options),
  tryRespawn: options => tryRespawn(player, options),
  getEquipmentAttributeTotals: () => getEquipmentAttributeTotals(player),
});

export default createPlayerStatsManager;
