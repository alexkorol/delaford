/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { PlayerPersistenceService } from '#server/core/services/player-persistence.js';

// Login accounts use local:<account id>; guests and retired token shapes use
// machine-local snapshots. No player save performs a network request.
const createMockPlayer = (uuid = 'player-1', username = 'TestUser') => ({
  uuid,
  username,
  token: `local:${uuid}`,
  update: vi.fn(),
});

describe('PlayerPersistenceService', () => {
  let service;
  let saveGuestPlayer;
  let saveLocalProfile;

  beforeEach(() => {
    saveGuestPlayer = vi.fn().mockResolvedValue({ saved: 'guest' });
    saveLocalProfile = vi.fn().mockResolvedValue({ saved: 'account' });
    service = new PlayerPersistenceService({
      saveGuestPlayer,
      saveLocalProfile,
      cooldownMs: 1000,
      logger: { error: vi.fn() },
    });
  });

  describe('savePlayer', () => {
    it('saves a login account through the local SQLite profile writer', async () => {
      const player = createMockPlayer();
      const result = await service.savePlayer(player);

      expect(saveLocalProfile).toHaveBeenCalledWith(player);
      expect(saveGuestPlayer).not.toHaveBeenCalled();
      expect(result).toEqual({ saved: 'account' });
    });

    it('returns null for null player', async () => {
      const result = await service.savePlayer(null);
      expect(result).toBeNull();
      expect(saveLocalProfile).not.toHaveBeenCalled();
      expect(saveGuestPlayer).not.toHaveBeenCalled();
    });

    it('routes guest players to the local file store, never the network', async () => {
      const guest = { ...createMockPlayer('guest-test-1', 'dev'), token: 'none' };
      const result = await service.savePlayer(guest);
      expect(result).toEqual({ saved: 'guest' });
      expect(saveGuestPlayer).toHaveBeenCalledWith(guest);
      expect(saveLocalProfile).not.toHaveBeenCalled();
    });

    it('routes retired non-local token shapes to a local snapshot', async () => {
      const legacy = { ...createMockPlayer(), token: 'jwt-retired-token' };

      expect(await service.savePlayer(legacy)).toEqual({ saved: 'guest' });
      expect(saveGuestPlayer).toHaveBeenCalledWith(legacy);
      expect(saveLocalProfile).not.toHaveBeenCalled();
    });

    it('records the save timestamp on success', async () => {
      const player = createMockPlayer();
      await service.savePlayer(player);

      expect(service.lastSuccessfulSave.has(player.uuid)).toBe(true);
    });

    it('throws and logs on local persistence failure', async () => {
      saveLocalProfile.mockRejectedValue(new Error('DB error'));
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
      saveLocalProfile.mockClear();

      const result = await service.savePlayer(player);
      expect(result).toBeNull();
      expect(saveLocalProfile).not.toHaveBeenCalled();
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
