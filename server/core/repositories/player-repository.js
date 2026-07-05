import axios from 'axios';

const sanitizeBaseUrl = (url) => {
  if (!url) {
    return '';
  }

  return url.endsWith('/') ? url.slice(0, -1) : url;
};

const cloneValue = (value) => {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  return Object.entries(value).reduce((acc, [key, entry]) => {
    acc[key] = cloneValue(entry);
    return acc;
  }, {});
};

export class PlayerRepository {
  constructor({ baseUrl, endpointPath = '/api/auth/update' } = {}) {
    this.baseUrl = sanitizeBaseUrl(baseUrl || process.env.SITE_URL || '');
    this.endpointPath = endpointPath;
  }

  get endpoint() {
    if (!this.baseUrl) {
      return this.endpointPath;
    }

    return `${this.baseUrl}${this.endpointPath}`;
  }

  buildWearSnapshot(player) {
    const wear = player?.wear || {};
    const snapshot = {};

    Object.entries(wear).forEach(([slot, data]) => {
      if (slot === 'arrows') {
        return;
      }

      if (data === null || data === undefined) {
        snapshot[slot] = null;
        return;
      }

      snapshot[slot] = typeof data === 'object' && data !== null && 'id' in data ? data.id : data;
    });

    return snapshot;
  }

  buildPlayerData(player) {
    return {
      x: player.x,
      y: player.y,
      username: player.username,
      hp_current: player.hp?.current,
      hp_max: player.hp?.max,
    };
  }

  buildPayload(player) {
    return {
      uuid: player.uuid,
      playerData: this.buildPlayerData(player),
      inventoryData: cloneValue(player.inventory?.slots || []),
      wearData: this.buildWearSnapshot(player),
      skillsData: cloneValue(player.skills || {}),
      bankData: cloneValue(player.bank || []),
      passiveTreeData: cloneValue(player.passiveTree || null),
    };
  }

  async save(player) {
    if (!player) {
      return null;
    }

    const payload = this.buildPayload(player);
    const headers = {};

    if (player.token && player.token !== 'none') {
      headers.Authorization = `Bearer ${player.token}`;
    }

    const response = await axios.post(this.endpoint, payload, { headers });
    return response.data;
  }
}

const playerRepository = new PlayerRepository({});

export default playerRepository;
