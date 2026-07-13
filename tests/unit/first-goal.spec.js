/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#server/socket.js', () => ({
  default: { emit: vi.fn() },
}));

const {
  notifyFirstGoalFloorCleared,
  notifyFirstGoalReturned,
  notifyFirstGoalWardenDown,
  talkToAldwyn,
} = await import('#server/core/first-goal.js');
const { default: Socket } = await import('#server/socket.js');

const makePlayer = () => ({
  socket_id: 'socket-first-goal',
  uuid: 'scion-first-goal',
  level: 1,
  questPoints: 0,
  quests: {},
  passiveTree: {
    schemaVersion: 2,
    nodes: ['0,0'],
    conduits: [],
    points: { skill: 2 },
    earned: 2,
    selectedNodeId: '0,0',
    classOrder: [],
  },
  refreshDerivedStats: vi.fn(),
});

const messages = () => Socket.emit.mock.calls
  .filter(([event]) => event === 'game:send:message')
  .map(([, payload]) => payload.text);

describe('Aldwyn first goal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('turns a town conversation into an explicit first-Warden objective', () => {
    const player = makePlayer();

    expect(talkToAldwyn(player)).toBe(true);
    expect(player.quests.firstGoal.stage).toBe('clear-floor');
    expect(messages().at(-1)).toMatch(/Warden.*come back/i);
    expect(Socket.emit).toHaveBeenCalledWith('quest:update', expect.objectContaining({
      quests: player.quests,
    }));
  });

  it('advances only for floor 1 of the named zone', () => {
    const player = makePlayer();
    talkToAldwyn(player);

    expect(notifyFirstGoalFloorCleared(player, {
      template: 'grove', layout: 'clearings', depth: 1,
    })).toBe(false);
    expect(player.quests.firstGoal.stage).toBe('clear-floor');

    expect(notifyFirstGoalFloorCleared(player, {
      template: 'dungeon', layout: 'warren', depth: 1,
    })).toBe(true);
    expect(player.quests.firstGoal.stage).toBe('return-to-town');
    expect(messages().at(-1)).toMatch(/Return to Aldwyn/i);
  });

  it('advances when a tier-1 world-web Warden goes down, and only tier 1', () => {
    const player = makePlayer();
    talkToAldwyn(player);

    expect(notifyFirstGoalWardenDown(player, { tier: 2 })).toBe(false);
    expect(player.quests.firstGoal.stage).toBe('clear-floor');

    expect(notifyFirstGoalWardenDown(player, { tier: 1 })).toBe(true);
    expect(player.quests.firstGoal.stage).toBe('return-to-town');
    expect(messages().at(-1)).toMatch(/Return to Aldwyn/i);
  });

  it('awards one persistent tree point exactly once on return', () => {
    const player = makePlayer();
    talkToAldwyn(player);
    notifyFirstGoalFloorCleared(player, {
      template: 'dungeon', layout: 'warren', depth: 1,
    });

    expect(notifyFirstGoalReturned(player)).toBe(true);
    expect(player.quests.firstGoal.stage).toBe('complete');
    expect(player.questPoints).toBe(1);
    expect(player.passiveTree.earned).toBe(3);
    expect(player.passiveTree.points.skill).toBe(3);
    expect(player.refreshDerivedStats).toHaveBeenCalledOnce();

    expect(notifyFirstGoalReturned(player)).toBe(false);
    expect(player.questPoints).toBe(1);
  });
});
