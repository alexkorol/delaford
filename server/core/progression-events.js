import { notifyTutorial } from '#server/core/tutorial.js';
import { notifyQuest } from '#server/core/services/quest-service.js';

export const notifyProgression = (player, trigger, context = {}) => ({
  tutorial: notifyTutorial(player, trigger),
  quest: notifyQuest(player, trigger, context),
});

export default { notifyProgression };
