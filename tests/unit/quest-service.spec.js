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

  it('advances in order, chains commissions, and awards each reward once', () => {
    const player = makePlayer();
    maybeStartQuest(player);

    expect(notifyQuest(player, 'loot')).toBe(false);
    QUEST_DEFINITIONS[0].objectives.forEach((objective) => {
      expect(notifyQuest(player, objective.trigger)).toBe(true);
    });

    expect(player.quests).toEqual(expect.objectContaining({
      activeQuestId: 'proof-of-temper',
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

    QUEST_DEFINITIONS[1].objectives.forEach((objective) => {
      expect(notifyQuest(player, objective.trigger)).toBe(true);
    });

    expect(player.quests).toEqual(expect.objectContaining({
      activeQuestId: 'the-pale-crown',
      objectiveIndex: 0,
      questPoints: 2,
      completed: [
        expect.objectContaining({ id: 'aldwyns-charge' }),
        expect.objectContaining({ id: 'proof-of-temper' }),
      ],
    }));
    expect(chroniclesStoreMock.recordScionDeed).toHaveBeenCalledWith(
      player.uuid,
      player.chronicles,
      { deed: 'Proved their temper in the old realms', renown: 10 },
    );

    vi.clearAllMocks();
    expect(notifyQuest(player, 'equip-vessel')).toBe(false);
    expect(player.quests.questPoints).toBe(2);
    expect(chroniclesStoreMock.recordScionDeed).not.toHaveBeenCalled();

    expect(notifyQuest(player, 'delve', {
      zoneId: 'sunken-colonnade', theme: 'crypt', depth: 1,
    })).toBe(false);
    expect(player.quests.objectiveIndex).toBe(0);
    expect(notifyQuest(player, 'delve', {
      zoneId: 'weir-crypt', theme: 'crypt', depth: 1,
    })).toBe(true);
    expect(player.quests.objectiveIndex).toBe(1);

    expect(notifyQuest(player, 'slay-elite', {
      monsterName: 'The Pale Sovereign', theme: 'stone', depth: 1,
    })).toBe(false);
    expect(notifyQuest(player, 'slay-elite', {
      monsterName: 'The Pale Sovereign', theme: 'crypt', depth: 1,
    })).toBe(true);
    expect(player.quests.objectiveIndex).toBe(2);

    expect(notifyQuest(player, 'delve', { template: 'stone', depth: 2 })).toBe(false);
    expect(notifyQuest(player, 'delve', { template: 'crypt', depth: 1 })).toBe(false);
    expect(notifyQuest(player, 'delve', { template: 'crypt', depth: 2 })).toBe(true);
    expect(player.quests).toEqual(expect.objectContaining({
      activeQuestId: 'rot-in-the-reeds',
      objectiveIndex: 0,
      questPoints: 3,
      completed: [
        expect.objectContaining({ id: 'aldwyns-charge' }),
        expect.objectContaining({ id: 'proof-of-temper' }),
        expect.objectContaining({ id: 'the-pale-crown' }),
      ],
    }));
    expect(chroniclesStoreMock.recordScionDeed).toHaveBeenCalledWith(
      player.uuid,
      player.chronicles,
      { deed: "Broke the Pale Sovereign's seal", renown: 15 },
    );

    vi.clearAllMocks();
    expect(notifyQuest(player, 'delve', { template: 'crypt', depth: 2 })).toBe(false);
    expect(player.quests.questPoints).toBe(3);
    expect(chroniclesStoreMock.recordScionDeed).not.toHaveBeenCalled();

    expect(notifyQuest(player, 'delve', {
      zoneId: 'the-wilds', theme: 'wilds', depth: 1,
    })).toBe(false);
    expect(notifyQuest(player, 'delve', {
      zoneId: 'marsh-of-reeds', theme: 'marsh', depth: 1,
    })).toBe(true);
    expect(notifyQuest(player, 'slay-elite', {
      monsterName: 'The Rotfather', theme: 'grove', depth: 1,
    })).toBe(false);
    expect(notifyQuest(player, 'slay-elite', {
      monsterName: 'The Rotfather', theme: 'marsh', depth: 1,
    })).toBe(true);
    expect(notifyQuest(player, 'return-surface', { zoneId: 'the-wilds' })).toBe(false);
    expect(notifyQuest(player, 'return-surface', { zoneId: 'marsh-of-reeds' })).toBe(true);
    expect(player.quests).toEqual(expect.objectContaining({
      activeQuestId: null,
      objectiveIndex: 0,
      questPoints: 4,
      completed: [
        expect.objectContaining({ id: 'aldwyns-charge' }),
        expect.objectContaining({ id: 'proof-of-temper' }),
        expect.objectContaining({ id: 'the-pale-crown' }),
        expect.objectContaining({ id: 'rot-in-the-reeds' }),
      ],
    }));
    expect(chroniclesStoreMock.recordScionDeed).toHaveBeenCalledWith(
      player.uuid,
      player.chronicles,
      { deed: 'Ended the rot beneath the reeds', renown: 20 },
    );

    vi.clearAllMocks();
    expect(notifyQuest(player, 'return-surface', { zoneId: 'marsh-of-reeds' })).toBe(false);
    expect(player.quests.questPoints).toBe(4);
    expect(chroniclesStoreMock.recordScionDeed).not.toHaveBeenCalled();
  });

  it('keeps server-only objective criteria out of the client journal', () => {
    const player = makePlayer();
    player.quests = {
      activeQuestId: 'the-pale-crown',
      objectiveIndex: 0,
      completed: [
        { id: 'aldwyns-charge', completedAt: 1 },
        { id: 'proof-of-temper', completedAt: 2 },
      ],
      questPoints: 2,
    };

    const log = questLogSnapshot(player);
    expect(log.active.objectives[0]).toEqual({
      id: 'enter-weir-crypt',
      trigger: 'delve',
      label: 'Enter Weir Crypt',
      completed: false,
      current: true,
    });
  });
});
