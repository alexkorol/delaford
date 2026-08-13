/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { PlayerPersistenceService } from '#server/core/services/player-persistence.js';
import {
  buildDurableItemSnapshot,
  buildGuestSnapshot,
} from '#server/core/repositories/guest-save-store.js';

// A real account player carries a JWT; guests carry token 'none' and are
// skipped by the network save entirely.
const createMockPlayer = (uuid = 'player-1', username = 'TestUser') => ({
  uuid,
  username,
  token: 'jwt-test-token',
  update: vi.fn(),
});

const createMockRepository = () => ({
  save: vi.fn().mockResolvedValue({ ok: true }),
});

describe('PlayerPersistenceService', () => {
  let service;
  let repository;

  beforeEach(() => {
    repository = createMockRepository();
    service = new PlayerPersistenceService({
      repository,
      cooldownMs: 1000,
      logger: { error: vi.fn() },
    });
  });

  describe('savePlayer', () => {
    it('saves a player through the repository', async () => {
      const player = createMockPlayer();
      const result = await service.savePlayer(player);

      expect(repository.save).toHaveBeenCalledWith(player);
      expect(result).toEqual({ ok: true });
    });

    it('returns null for null player', async () => {
      const result = await service.savePlayer(null);
      expect(result).toBeNull();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('routes guest players to the local file store, never the network', async () => {
      const guest = { ...createMockPlayer('guest-test-1', 'dev'), token: 'none' };
      const result = await service.savePlayer(guest);
      // A snapshot comes back from the file store; the account API is untouched.
      expect(result).toBeTruthy();
      expect(result.level).toBe(guest.level);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('records the save timestamp on success', async () => {
      const player = createMockPlayer();
      await service.savePlayer(player);

      expect(service.lastSuccessfulSave.has(player.uuid)).toBe(true);
    });

    it('throws and logs on repository failure', async () => {
      repository.save.mockRejectedValue(new Error('DB error'));
      const player = createMockPlayer();

      await expect(service.savePlayer(player)).rejects.toThrow('DB error');
      expect(service.logger.error).toHaveBeenCalled();
    });
  });

  it('keeps Chronicles identity and hard lifecycle in guest snapshots', () => {
    const snapshot = buildGuestSnapshot({
      uuid: 'guest-mortal',
      x: 38,
      y: 115,
      level: 7,
      stats: {
        resources: {
          health: { current: 0, max: 150 },
          mana: { current: 60, max: 60 },
        },
        lifecycle: { mode: 'hard', state: 'permadead' },
      },
      chronicles: { houseId: 'house-1', scionId: 'scion-1', mortal: true },
      quests: {
        version: 1,
        activeQuestId: 'aldwyns-charge',
        objectiveIndex: 3,
        questPoints: 0,
        completed: [],
      },
      inventory: { slots: [] },
      wear: {},
      skills: {},
      bank: [],
    });

    expect(snapshot.chronicles).toEqual({
      houseId: 'house-1',
      scionId: 'scion-1',
      mortal: true,
    });
    expect(snapshot.lifecycle).toEqual({ mode: 'hard', state: 'permadead' });
    expect(snapshot.resources.health.current).toBe(0);
    expect(snapshot.quests).toEqual(expect.objectContaining({
      activeQuestId: 'aldwyns-charge',
      objectiveIndex: 3,
    }));
  });

  it('keeps rolled inventory and equipped-item identity while stripping world state', () => {
    const rolledItem = {
      id: 'bronze-sword',
      uuid: 'rolled-sword-1',
      name: 'Gleaming Bronze Sword of Sparks',
      displayName: 'Gleaming Bronze Sword of Sparks',
      slot: 13,
      position: { x: 1, y: 1 },
      orientation: 'rotated',
      boundTo: 'guest-rich-items',
      stats: { attack: { slash: 17 } },
      affixes: {
        brand: { id: 'gleaming', value: 4 },
        bond: { id: 'sparks', value: 3 },
      },
      vessel: {
        material: 'Bronze',
        item: { id: 'vessel-1', patience: 5, brands: [{ id: 'brand-1' }] },
        lines: [{ section: 'vessel', text: 'Vessel 3' }],
      },
      x: 44,
      y: 52,
      timestamp: 1234,
      context: 'item',
      isLocked: true,
    };
    const equipped = {
      ...rolledItem,
      uuid: 'equipped-sword-1',
      slot: 'right_hand',
    };
    const snapshot = buildGuestSnapshot({
      uuid: 'guest-rich-items',
      level: 5,
      x: 38,
      y: 115,
      inventory: { slots: [rolledItem] },
      wear: { right_hand: equipped, armor: null, arrows: null },
      skills: {},
      bank: [],
      stats: { resources: {}, lifecycle: {} },
    });

    expect(snapshot.inventory[0]).toEqual(expect.objectContaining({
      uuid: 'rolled-sword-1',
      name: 'Gleaming Bronze Sword of Sparks',
      orientation: 'rotated',
      boundTo: 'guest-rich-items',
      affixes: rolledItem.affixes,
      vessel: rolledItem.vessel,
      stats: rolledItem.stats,
    }));
    expect(snapshot.wear.right_hand).toEqual(expect.objectContaining({
      uuid: 'equipped-sword-1',
      vessel: rolledItem.vessel,
    }));
    expect(snapshot.wear.armor).toBeNull();
    expect(snapshot.wear).not.toHaveProperty('arrows');
    expect(snapshot.inventory[0]).not.toHaveProperty('x');
    expect(snapshot.inventory[0]).not.toHaveProperty('timestamp');
    expect(snapshot.inventory[0]).not.toHaveProperty('isLocked');
    expect(buildDurableItemSnapshot(null)).toBeNull();
  });

  describe('shouldThrottleSave', () => {
    it('does not throttle the first save', () => {
      const player = createMockPlayer();
      expect(service.shouldThrottleSave(player)).toBe(false);
    });

    it('throttles saves within the cooldown period', async () => {
      const player = createMockPlayer();
      await service.savePlayer(player);

      expect(service.shouldThrottleSave(player)).toBe(true);
    });

    it('bypasses throttle when force is true', async () => {
      const player = createMockPlayer();
      await service.savePlayer(player);

      expect(service.shouldThrottleSave(player, { force: true })).toBe(false);
    });

    it('skips save when throttled', async () => {
      const player = createMockPlayer();
      await service.savePlayer(player);
      repository.save.mockClear();

      const result = await service.savePlayer(player);
      expect(result).toBeNull();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('markDirty', () => {
    it('resets the last save timestamp so next save is not throttled', async () => {
      const player = createMockPlayer();
      await service.savePlayer(player);

      expect(service.shouldThrottleSave(player)).toBe(true);

      service.markDirty(player);

      expect(service.shouldThrottleSave(player)).toBe(false);
    });

    it('does nothing for null player', () => {
      expect(() => service.markDirty(null)).not.toThrow();
    });
  });
});
