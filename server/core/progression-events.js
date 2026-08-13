import { notifyTutorial } from '#server/core/tutorial.js';
import { notifyQuest } from '#server/core/services/quest-service.js';

export const notifyProgression = (player, trigger) => ({
  tutorial: notifyTutorial(player, trigger),
  quest: notifyQuest(player, trigger),
});

export default { notifyProgression };
