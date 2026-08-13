import Socket from '#server/socket.js';
import {
  MAX_QUEST_POINTS,
  QUEST_DEFINITIONS,
  QUEST_SCHEMA_VERSION,
  getQuestDefinition,
} from '#shared/quests.js';
import chroniclesStore from '#server/core/services/chronicles-store.js';
import playerPersistence from '#server/core/services/player-persistence.js';

const cleanTimestamp = value => (Number.isFinite(Number(value)) ? Number(value) : null);

export const normaliseQuestState = (candidate = {}) => {
  const source = candidate && typeof candidate === 'object' ? candidate : {};
  const completed = Array.isArray(source.completed)
    ? source.completed
      .filter(entry => entry && getQuestDefinition(entry.id))
      .map(entry => ({
        id: entry.id,
        completedAt: cleanTimestamp(entry.completedAt) || Date.now(),
      }))
      .filter((entry, index, entries) => entries.findIndex(other => other.id === entry.id) === index)
    : [];
  const requestedActiveId = typeof source.activeQuestId === 'string'
    ? source.activeQuestId
    : null;
  const active = getQuestDefinition(requestedActiveId);
  const alreadyCompleted = active && completed.some(entry => entry.id === active.id);
  const objectiveIndex = active
    ? Math.min(active.objectives.length, Math.max(0, Math.floor(Number(source.objectiveIndex) || 0)))
    : 0;

  return {
    version: QUEST_SCHEMA_VERSION,
    activeQuestId: active && !alreadyCompleted && objectiveIndex < active.objectives.length
      ? active.id
      : null,
    objectiveIndex: active && !alreadyCompleted ? objectiveIndex : 0,
    startedAt: active && !alreadyCompleted
      ? cleanTimestamp(source.startedAt) || Date.now()
      : null,
    completed,
    questPoints: Math.min(
      MAX_QUEST_POINTS,
      Math.max(0, Math.floor(Number(source.questPoints) || 0)),
    ),
  };
};

export const ensureQuestState = (player) => {
  if (!player) {
    return normaliseQuestState();
  }
  player.quests = normaliseQuestState(player.quests);
  return player.quests;
};

export const questLogSnapshot = (player) => {
  const state = ensureQuestState(player);
  const definition = getQuestDefinition(state.activeQuestId);
  return {
    ...state,
    active: definition ? {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      objectiveIndex: state.objectiveIndex,
      objectives: definition.objectives.map((objective, index) => ({
        id: objective.id,
        trigger: objective.trigger,
        label: objective.label,
        completed: index < state.objectiveIndex,
        current: index === state.objectiveIndex,
      })),
      rewards: { ...definition.rewards },
    } : null,
  };
};

export const emitQuestLog = (player) => {
  if (!player || !player.socket_id) {
    return;
  }
  Socket.emit('player:quests:update', {
    player: { socket_id: player.socket_id },
    quests: questLogSnapshot(player),
  });
};

export const maybeStartQuest = (player) => {
  const state = ensureQuestState(player);
  if (state.activeQuestId || !QUEST_DEFINITIONS.length) {
    return false;
  }
  const next = QUEST_DEFINITIONS.find(quest => (
    !state.completed.some(entry => entry.id === quest.id)
  ));
  if (!next) {
    return false;
  }
  state.activeQuestId = next.id;
  state.objectiveIndex = 0;
  state.startedAt = Date.now();
  return true;
};

export const currentQuestObjective = (player) => {
  const state = ensureQuestState(player);
  const definition = getQuestDefinition(state.activeQuestId);
  return definition?.objectives?.[state.objectiveIndex] || null;
};

export const isActiveQuest = (player, questId) => (
  ensureQuestState(player).activeQuestId === questId
);

export const questObjectiveMatches = (objective, context = {}) => {
  const criteria = objective && objective.criteria;
  if (!criteria || typeof criteria !== 'object') {
    return true;
  }

  return Object.entries(criteria).every(([key, expected]) => {
    if (key === 'minDepth') {
      return Number.isFinite(Number(context.depth)) && Number(context.depth) >= Number(expected);
    }
    const actual = context && context[key];
    return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
  });
};

export const isCurrentQuestObjective = (player, trigger, context = {}) => {
  const objective = currentQuestObjective(player);
  return objective?.trigger === trigger && questObjectiveMatches(objective, context);
};

const completeQuest = (player, definition) => {
  const state = ensureQuestState(player);
  if (state.completed.some(entry => entry.id === definition.id)) {
    return false;
  }

  const completedAt = Date.now();
  state.completed.push({ id: definition.id, completedAt });
  state.questPoints = Math.min(
    MAX_QUEST_POINTS,
    state.questPoints + Math.max(0, definition.rewards.passivePoints || 0),
  );
  state.activeQuestId = null;
  state.objectiveIndex = 0;
  state.startedAt = null;

  const chronicles = player.chronicles;
  if (chronicles && chronicles.houseId && chronicles.scionId) {
    chroniclesStore.recordScionDeed(player.uuid, chronicles, {
      deed: definition.deed,
      renown: definition.rewards.houseRenown,
    });
  }

  maybeStartQuest(player);
  playerPersistence.markDirty(player);
  playerPersistence.savePlayer(player, { force: true }).catch(() => {});
  Socket.emit('game:send:message', {
    player: { socket_id: player.socket_id },
    text: `Quest complete: ${definition.title}. +${definition.rewards.passivePoints} passive point, +${definition.rewards.houseRenown} House renown.`,
  });
  return true;
};

export const notifyQuest = (player, trigger, context = {}) => {
  if (!player || typeof trigger !== 'string') {
    return false;
  }
  maybeStartQuest(player);
  const state = ensureQuestState(player);
  const definition = getQuestDefinition(state.activeQuestId);
  const objective = definition && definition.objectives[state.objectiveIndex];
  if (!definition || !objective || objective.trigger !== trigger
    || !questObjectiveMatches(objective, context)) {
    return false;
  }

  state.objectiveIndex += 1;
  const completed = state.objectiveIndex >= definition.objectives.length;
  if (completed) {
    completeQuest(player, definition);
  }
  emitQuestLog(player);
  return true;
};

export default {
  emitQuestLog,
  ensureQuestState,
  currentQuestObjective,
  isActiveQuest,
  isCurrentQuestObjective,
  maybeStartQuest,
  normaliseQuestState,
  notifyQuest,
  questObjectiveMatches,
  questLogSnapshot,
};
