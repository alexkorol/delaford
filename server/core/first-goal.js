import { sendMessage } from '#server/core/combat/experience.js';
import {
  resetVerdigrisTree,
  resolveVerdigrisTree,
} from '#server/core/passives/verdigris-authority.js';
import playerPersistence from '#server/core/services/player-persistence.js';
import Socket from '#server/socket.js';

export const FIRST_GOAL_ID = 'firstGoal';
export const QUEST_POINT_CAP = 23;

const initialGoal = () => ({ stage: 'available', startedAt: null, completedAt: null });

export const ensureFirstGoal = (player) => {
  if (!player.quests || typeof player.quests !== 'object') player.quests = {};
  if (!player.quests[FIRST_GOAL_ID] || typeof player.quests[FIRST_GOAL_ID] !== 'object') {
    player.quests[FIRST_GOAL_ID] = initialGoal();
  }
  return player.quests[FIRST_GOAL_ID];
};

const say = (player, text) => sendMessage(player, `Aldwyn the Guide: ${text}`);

const pushQuestState = (player) => {
  Socket.emit('quest:update', {
    player: { socket_id: player.socket_id },
    quests: player.quests,
    questPoints: player.questPoints || 0,
    passiveTree: player.passiveTree || null,
  });
};

const refreshTreeBudget = (player) => {
  const resolved = player.passiveTree
    ? resolveVerdigrisTree(player.passiveTree, player.level, player.questPoints)
    : resetVerdigrisTree(player.level, player.questPoints);
  if (!resolved.ok) return false;
  player.passiveTree = resolved.snapshot;
  player.passiveTreeStats = resolved.stats;
  player.refreshDerivedStats({ passiveAttributes: resolved.attributes });
  return true;
};

export const talkToAldwyn = (player) => {
  if (!player) return false;
  const goal = ensureFirstGoal(player);

  if (goal.stage === 'available') {
    goal.stage = 'clear-floor';
    goal.startedAt = Date.now();
    say(player, 'The dead stir in The Old Barrow. Clear floor 1, then return to me in Delaford.');
    pushQuestState(player);
    playerPersistence.markDirty(player);
    return true;
  }

  if (goal.stage === 'clear-floor') {
    say(player, 'Your task remains: clear floor 1 of The Old Barrow, then return to me.');
    return true;
  }

  if (goal.stage === 'return-to-town') {
    say(player, 'The barrow is quiet. Return to Delaford and I will mark the deed.');
    return true;
  }

  say(player, 'The Old Barrow remembers your victory. Spend your Verdigris point wisely.');
  return true;
};

export const notifyFirstGoalFloorCleared = (player, { template, layout, depth } = {}) => {
  const goal = ensureFirstGoal(player);
  if (goal.stage !== 'clear-floor'
    || template !== 'dungeon'
    || layout !== 'warren'
    || depth !== 1) return false;

  goal.stage = 'return-to-town';
  say(player, 'The Old Barrow is cleared. Return to Aldwyn in Delaford for your reward.');
  pushQuestState(player);
  playerPersistence.markDirty(player);
  return true;
};

export const notifyFirstGoalReturned = (player) => {
  const goal = ensureFirstGoal(player);
  if (goal.stage !== 'return-to-town') return false;

  goal.stage = 'complete';
  goal.completedAt = Date.now();
  player.questPoints = Math.min(QUEST_POINT_CAP, Math.max(0, player.questPoints || 0) + 1);
  refreshTreeBudget(player);
  say(player, 'You kept your word. Take this Verdigris point; it opens another path in your skill tree.');
  pushQuestState(player);
  playerPersistence.markDirty(player);
  return true;
};

export default {
  ensureFirstGoal,
  notifyFirstGoalFloorCleared,
  notifyFirstGoalReturned,
  talkToAldwyn,
};
