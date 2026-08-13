/** @vitest-environment node */

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('#server/socket.js', () => ({
  default: {
    emit: vi.fn(),
  },
}));

const chroniclesStoreMock = vi.hoisted(() => ({
  recordScionDeed: vi.fn(() => ({ ok: true })),
}));

vi.mock('#server/core/services/chronicles-store.js', () => ({
  default: chroniclesStoreMock,
}));

const persistenceMock = vi.hoisted(() => ({
  markDirty: vi.fn(),
  savePlayer: vi.fn(() => Promise.resolve({ ok: true })),
}));

vi.mock('#server/core/services/player-persistence.js', () => ({
  default: persistenceMock,
}));

const {
  maybeStartQuest,
  normaliseQuestState,
  notifyQuest,
  questLogSnapshot,
} = await import('#server/core/services/quest-service.js');
const { QUEST_DEFINITIONS } = await import('#shared/quests.js');
const { default: Socket } = await import('#server/socket.js');

const makePlayer = () => ({
  uuid: 'account-1',
  socket_id: 'socket-1',
  chronicles: {
    houseId: 'house-1',
    scionId: 'scion-1',
  },
});

describe('authoritative quest progression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalises malformed persisted state without inventing rewards', () => {
    expect(normaliseQuestState({
      activeQuestId: 'unknown',
      objectiveIndex: 999,
      questPoints: 999,
      completed: [{ id: 'unknown' }],
    })).toEqual(expect.objectContaining({
      activeQuestId: null,
      objectiveIndex: 0,
      questPoints: 23,
      completed: [],
    }));
  });

  it('starts the first incomplete quest and exposes objective state', () => {
    const player = makePlayer();

    expect(maybeStartQuest(player)).toBe(true);
    const log = questLogSnapshot(player);

    expect(log.active.title).toBe("Aldwyn's Charge");
    expect(log.active.objectives[0]).toEqual(expect.objectContaining({
      trigger: 'move',
      current: true,
    }));
    expect(maybeStartQuest(player)).toBe(false);
  });

  it('advances in order and awards passive points, renown, and a deed once', () => {
    const player = makePlayer();
    maybeStartQuest(player);

    expect(notifyQuest(player, 'loot')).toBe(false);
    QUEST_DEFINITIONS[0].objectives.forEach((objective) => {
      expect(notifyQuest(player, objective.trigger)).toBe(true);
    });

    expect(player.quests).toEqual(expect.objectContaining({
      activeQuestId: null,
      objectiveIndex: 0,
      questPoints: 1,
      completed: [expect.objectContaining({ id: 'aldwyns-charge' })],
    }));
    expect(chroniclesStoreMock.recordScionDeed).toHaveBeenCalledWith(
      player.uuid,
      player.chronicles,
      { deed: "Answered Aldwyn's Charge", renown: 5 },
    );
    expect(persistenceMock.savePlayer).toHaveBeenCalledWith(player, { force: true });
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      text: expect.stringContaining('Quest complete'),
    }));

    vi.clearAllMocks();
    expect(notifyQuest(player, 'move')).toBe(false);
    expect(player.quests.questPoints).toBe(1);
    expect(chroniclesStoreMock.recordScionDeed).not.toHaveBeenCalled();
  });
});
