import playerRepository from '#server/core/repositories/player-repository.js';
import { saveGuest } from '#server/core/repositories/guest-save-store.js';
import world from '#server/core/world.js';

const DEFAULT_COOLDOWN_MS = Number(process.env.PLAYER_SAVE_COOLDOWN_MS) || 60000;

export class PlayerPersistenceService {
  constructor({
    repository = playerRepository,
    cooldownMs = DEFAULT_COOLDOWN_MS,
    logger = console,
  } = {}) {
    this.repository = repository;
    this.cooldownMs = cooldownMs;
    this.logger = logger;
    this.lastSuccessfulSave = new Map();
  }

  shouldThrottleSave(player, { force = false } = {}) {
    if (force) {
      return false;
    }

    const lastSavedAt = this.lastSuccessfulSave.get(player.uuid) || 0;
    const elapsed = Date.now() - lastSavedAt;

    return elapsed < this.cooldownMs;
  }

  async savePlayer(player, options = {}) {
    if (!player) {
      return null;
    }

    if (this.shouldThrottleSave(player, options)) {
      return null;
    }

    // Guest accounts have no backing account API; they persist to a local
    // file instead so loot/levels/tree survive relogins during dev.
    if (!player.token || player.token === 'none') {
      const snapshot = saveGuest(player);
      if (snapshot) {
        this.lastSuccessfulSave.set(player.uuid, Date.now());
      }
      return snapshot;
    }

    try {
      const result = await this.repository.save(player);
      this.lastSuccessfulSave.set(player.uuid, Date.now());
      return result;
    } catch (error) {
      if (this.logger && typeof this.logger.error === 'function') {
        this.logger.error(`[player-persistence] Failed to save ${player.username || player.uuid}`, error);
      }
      throw error;
    }
  }

  async flushAllPlayers(options = {}) {
    const players = [...world.players];
    if (!players.length) {
      return { saved: 0, total: 0 };
    }

    const results = await Promise.all(players.map(async (player) => {
      try {
        const saved = await this.savePlayer(player, options);
        return saved ? 1 : 0;
      } catch (error) {
        return 0;
      }
    }));

    const savedCount = results.reduce((sum, value) => sum + value, 0);
    return { saved: savedCount, total: players.length };
  }

  markDirty(player) {
    if (!player) {
      return;
    }

    this.lastSuccessfulSave.set(player.uuid, 0);
  }
}

const playerPersistenceService = new PlayerPersistenceService();

export default playerPersistenceService;
