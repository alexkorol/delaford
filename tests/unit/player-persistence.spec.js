/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { PlayerPersistenceService } from '#server/core/services/player-persistence.js';

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
