import {
  awardSkillExperience,
  getCombatExperienceTotal,
  sendMessage,
} from '#server/core/combat/experience.js';

const GUIDE_NAME = 'Aldwyn the Guide';

// Linear onboarding: each step waits for one gameplay trigger. Steps are
// only advanced by their own trigger, so players can do things out of
// order without losing progress.
export const TUTORIAL_STEPS = [
  {
    id: 'move',
    trigger: 'move',
    prompt: 'First things first: use W, A, S and D to take a walk around town.',
    completion: 'You walk with purpose already.',
  },
  {
    id: 'attack',
    trigger: 'attack',
    prompt: 'Steel answers steel out here. Walk into a monster to strike it, or face one and use your attack key.',
    completion: 'A solid strike!',
  },
  {
    id: 'slay',
    trigger: 'slay',
    prompt: 'Now finish the job — slay it. Watch its health bar fall.',
    completion: 'It falls before you, and the realm takes note. Kills grant experience; levels make you stronger.',
  },
  {
    id: 'loot',
    trigger: 'loot',
    prompt: 'The fallen leave their spoils behind. Pick an item up off the ground.',
    completion: 'Spoils rightfully claimed. Check your backpack on the right.',
  },
  {
    id: 'delve',
    trigger: 'delve',
    prompt: 'You are ready for the depths. Form a party and enter an instance — the true treasures wait below.',
    completion: 'The dungeon swallows you whole. This is where legends are made — and where they end. Tread carefully.',
  },
];

export const TUTORIAL_REWARD = {
  coins: 150,
  experience: 30,
};

const say = (player, text) => {
  sendMessage(player, `${GUIDE_NAME}: ${text}`);
};

const ensureState = (player) => {
  if (!player.tutorial || typeof player.tutorial !== 'object') {
    player.tutorial = { step: 0, startedAt: null, completedAt: null };
  }
  return player.tutorial;
};

/**
 * Begin the onboarding for a freshly logged-in character. Veterans
 * (anyone with combat experience) are marked complete silently.
 *
 * @param {object} player The player who just joined
 * @returns {boolean} Whether the tutorial was started
 */
export const maybeStartTutorial = (player) => {
  if (!player) {
    return false;
  }

  const state = ensureState(player);
  if (state.startedAt || state.completedAt) {
    return false;
  }

  if (getCombatExperienceTotal(player) > 0) {
    state.completedAt = Date.now();
    return false;
  }

  state.startedAt = Date.now();
  say(player, `Welcome to Delaford, ${player.username || 'adventurer'}. I am ${GUIDE_NAME.split(' ')[0]}, and it falls to me to keep new blood alive long enough to matter.`);
  say(player, TUTORIAL_STEPS[0].prompt);
  return true;
};

/**
 * Report a gameplay trigger for a player. Advances the tutorial when it
 * matches the current step; hands out the completion reward at the end.
 *
 * @param {object} player The acting player
 * @param {string} trigger One of the TUTORIAL_STEPS trigger ids
 * @returns {boolean} Whether the tutorial advanced
 */
export const notifyTutorial = (player, trigger) => {
  if (!player || !player.tutorial) {
    return false;
  }

  const state = player.tutorial;
  if (!state.startedAt || state.completedAt) {
    return false;
  }

  const step = TUTORIAL_STEPS[state.step || 0];
  if (!step || step.trigger !== trigger) {
    return false;
  }

  state.step = (state.step || 0) + 1;
  say(player, step.completion);

  const next = TUTORIAL_STEPS[state.step];
  if (next) {
    say(player, next.prompt);
    return true;
  }

  state.completedAt = Date.now();
  awardSkillExperience(player, 'attack', TUTORIAL_REWARD.experience);
  if (player.inventory && typeof player.inventory.add === 'function') {
    Promise.resolve(player.inventory.add('coins', TUTORIAL_REWARD.coins)).catch(() => {});
  }
  say(player, `Your training is complete. Take this purse of ${TUTORIAL_REWARD.coins} coins — you have earned it. Delaford is yours to explore.`);
  return true;
};

export default {
  TUTORIAL_STEPS,
  TUTORIAL_REWARD,
  maybeStartTutorial,
  notifyTutorial,
};
