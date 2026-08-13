/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#server/socket.js', () => ({
  default: {
    emit: vi.fn(),
    broadcast: vi.fn(),
    sendMessageToPlayer: vi.fn(),
  },
}));

vi.mock('#server/core/entities/player/stats-manager.js', () => ({
  broadcastStats: vi.fn(),
  default: vi.fn(),
}));

const {
  maybeStartTutorial,
  notifyTutorial,
  TUTORIAL_STEPS,
  TUTORIAL_REWARD,
} = await import('#server/core/tutorial.js');
const { default: Socket } = await import('#server/socket.js');

const messagesSentTo = player => Socket.emit.mock.calls
  .filter(([event, payload]) => event === 'game:send:message'
    && payload.player.socket_id === player.socket_id)
  .map(([, payload]) => payload.text);

const makeNewPlayer = () => ({
  uuid: 'player-tutorial',
  socket_id: 'socket-tutorial',
  username: 'Newcomer',
  level: 1,
  skills: {
    attack: { level: 1, exp: 0 },
    defence: { level: 1, exp: 0 },
  },
  stats: {
    resources: {
      health: { current: 50, max: 50 },
      mana: { current: 40, max: 40 },
    },
    lifecycle: { state: 'alive' },
  },
  inventory: { add: vi.fn(() => Promise.resolve()) },
  refreshDerivedStats: vi.fn(),
});

describe('tutorial onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('welcomes brand-new characters and prompts the first step', () => {
    const player = makeNewPlayer();

    expect(maybeStartTutorial(player)).toBe(true);

    const messages = messagesSentTo(player);
    expect(messages[0]).toContain('Welcome to Delaford, Newcomer');
    expect(messages[1]).toContain(TUTORIAL_STEPS[0].prompt);
    expect(player.tutorial.startedAt).toBeTruthy();
  });

  it('skips veterans without saying anything', () => {
    const player = makeNewPlayer();
    player.skills.attack.exp = 500;

    expect(maybeStartTutorial(player)).toBe(false);
    expect(player.tutorial.completedAt).toBeTruthy();
    expect(messagesSentTo(player)).toHaveLength(0);
  });

  it('does not restart once started', () => {
    const player = makeNewPlayer();
    maybeStartTutorial(player);
    vi.clearAllMocks();

    expect(maybeStartTutorial(player)).toBe(false);
    expect(messagesSentTo(player)).toHaveLength(0);
  });

  it('advances only on the trigger matching the current step', () => {
    const player = makeNewPlayer();
    maybeStartTutorial(player);

    // Looting before moving does nothing
    expect(notifyTutorial(player, 'loot')).toBe(false);
    expect(player.tutorial.step).toBe(0);

    expect(notifyTutorial(player, 'move')).toBe(true);
    expect(player.tutorial.step).toBe(1);

    const messages = messagesSentTo(player);
    expect(messages.some(text => text.includes(TUTORIAL_STEPS[1].prompt))).toBe(true);
  });

  it('walks the full journey and pays out the completion reward', () => {
    const player = makeNewPlayer();
    maybeStartTutorial(player);

    TUTORIAL_STEPS.forEach((step) => {
      expect(notifyTutorial(player, step.trigger)).toBe(true);
    });

    expect(player.tutorial.completedAt).toBeTruthy();
    expect(player.skills.attack.exp).toBe(TUTORIAL_REWARD.experience);
    expect(player.inventory.add).toHaveBeenCalledWith('coins', TUTORIAL_REWARD.coins);
    expect(messagesSentTo(player).at(-1)).toContain('press C for your character sheet');

    // Further triggers are ignored once complete
    vi.clearAllMocks();
    expect(notifyTutorial(player, 'move')).toBe(false);
    expect(messagesSentTo(player)).toHaveLength(0);
  });

  it('ignores triggers for players who never started', () => {
    const player = makeNewPlayer();
    expect(notifyTutorial(player, 'move')).toBe(false);
    expect(notifyTutorial(null, 'move')).toBe(false);
  });
});
