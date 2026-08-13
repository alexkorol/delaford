/**
 * Durable, account-scoped Chronicles records.
 *
 * Browser localStorage is retained as an offline cache and one-time migration
 * source, but this store is authoritative once an account record exists. A
 * client may add Houses/living Scions and change its active selection; it may
 * never delete existing records, rewrite server-owned fields, inject crypt
 * entries, or resurrect a fallen Scion.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validateHouseName,
  validateScionName,
} from '#shared/chronicles.js';
import { buildDurableItemSnapshot } from '#server/core/repositories/guest-save-store.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STORE_FILE = path.resolve(here, '..', '..', 'data', 'chronicles-store.json');

export const CHRONICLES_SCHEMA_VERSION = 3;
const STORE_SCHEMA_VERSION = 1;
const MAX_HOUSES = 8;
const MAX_SCIONS_PER_HOUSE = 32;
const MAX_DEEDS_PER_SCION = 100;
const MAX_DEED_LENGTH = 160;
const MAX_LEVEL = 9999;
const MAX_RENOWN = 1_000_000_000;
const MAX_CLIENT_MIGRATION_BYTES = 12 * 1024;
const MAX_SERVER_RECORD_BYTES = 512 * 1024;
const MAX_RELIC_BYTES = 24 * 1024;
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;
const RELIC_STATUSES = new Set(['queued', 'circulating', 'recovered']);

const clone = value => JSON.parse(JSON.stringify(value));

export const emptyChroniclesState = () => ({
  version: CHRONICLES_SCHEMA_VERSION,
  houses: [],
  activeHouseId: null,
  activeScionId: null,
});

const cleanId = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const id = value.trim();
  return ID_PATTERN.test(id) ? id : null;
};

const cleanTimestamp = (value, fallback = null) => {
  if (typeof value !== 'string' || value.length > 64) {
    return fallback;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : fallback;
};

const cleanInteger = (value, fallback, maximum) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(0, Math.floor(numeric)));
};

const sanitiseRelic = (candidate, { resetCirculation = false } = {}) => {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }
  const id = cleanId(candidate.id);
  const item = buildDurableItemSnapshot(candidate.item);
  if (!id || !item || cleanId(item.uuid) !== id
    || JSON.stringify(item).length > MAX_RELIC_BYTES) {
    return null;
  }

  const requestedStatus = RELIC_STATUSES.has(candidate.status) ? candidate.status : 'queued';
  const status = resetCirculation && requestedStatus === 'circulating'
    ? 'queued'
    : requestedStatus;
  return {
    id,
    status,
    item,
    droppedAt: status === 'circulating'
      ? cleanTimestamp(candidate.droppedAt, new Date().toISOString())
      : null,
    recoveredAt: status === 'recovered'
      ? cleanTimestamp(candidate.recoveredAt, new Date().toISOString())
      : null,
  };
};

const sanitiseScion = (candidate, {
  fallen = false,
  preserveRelics = false,
  resetCirculation = false,
} = {}) => {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }
  const id = cleanId(candidate.id);
  const validation = validateScionName(candidate.name);
  if (!id || !validation.valid) {
    return null;
  }

  const diedAt = cleanTimestamp(candidate.diedAt, fallen ? new Date().toISOString() : null);

  const relic = fallen && preserveRelics
    ? sanitiseRelic(candidate.relic, { resetCirculation })
    : null;

  return {
    id,
    name: validation.value,
    level: Math.max(1, cleanInteger(candidate.level, 1, MAX_LEVEL)),
    bornAt: cleanTimestamp(candidate.bornAt, new Date().toISOString()),
    diedAt: fallen ? diedAt : null,
    deeds: Array.isArray(candidate.deeds)
      ? candidate.deeds
        .filter(deed => typeof deed === 'string')
        .map(deed => deed.trim().slice(0, MAX_DEED_LENGTH))
        .filter(Boolean)
        .slice(0, MAX_DEEDS_PER_SCION)
      : [],
    mortal: candidate.mortal === true,
    ...(relic ? { relic } : {}),
  };
};

const sanitiseScions = (candidates, options = {}) => {
  if (!Array.isArray(candidates) || candidates.length > MAX_SCIONS_PER_HOUSE) {
    return null;
  }
  const clean = candidates.map(candidate => sanitiseScion(candidate, options));
  if (clean.some(scion => !scion)) {
    return null;
  }
  const ids = new Set(clean.map(scion => scion.id));
  return ids.size === clean.length ? clean : null;
};

const sanitiseHouse = (candidate, options = {}) => {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }
  const id = cleanId(candidate.id);
  const validation = validateHouseName(candidate.name);
  const scions = sanitiseScions(candidate.scions);
  const crypt = sanitiseScions(candidate.crypt, {
    fallen: true,
    preserveRelics: options.preserveRelics === true,
    resetCirculation: options.resetCirculation === true,
  });
  if (!id || !validation.valid || !scions || !crypt) {
    return null;
  }
  const allIds = [...scions, ...crypt].map(scion => scion.id);
  if (allIds.length > MAX_SCIONS_PER_HOUSE || new Set(allIds).size !== allIds.length) {
    return null;
  }

  return {
    id,
    name: validation.value,
    renown: cleanInteger(candidate.renown, 0, MAX_RENOWN),
    foundedAt: cleanTimestamp(candidate.foundedAt, new Date().toISOString()),
    scions,
    crypt,
  };
};

export const sanitiseChroniclesState = (candidate, options = {}) => {
  const maximumBytes = options.preserveRelics
    ? MAX_SERVER_RECORD_BYTES
    : MAX_CLIENT_MIGRATION_BYTES;
  if (!candidate || typeof candidate !== 'object' || !Array.isArray(candidate.houses)
    || candidate.houses.length > MAX_HOUSES
    || JSON.stringify(candidate).length > maximumBytes) {
    return { ok: false, reason: 'The Chronicles record has an invalid shape.' };
  }

  const houses = candidate.houses.map(house => sanitiseHouse(house, options));
  if (houses.some(house => !house)) {
    return { ok: false, reason: 'The Chronicles record contains an invalid House or Scion.' };
  }
  const houseIds = new Set(houses.map(house => house.id));
  if (houseIds.size !== houses.length) {
    return { ok: false, reason: 'The Chronicles record contains duplicate House identifiers.' };
  }

  const requestedHouseId = cleanId(candidate.activeHouseId);
  const activeHouse = houses.find(house => house.id === requestedHouseId) || houses[0] || null;
  const requestedScionId = cleanId(candidate.activeScionId);
  const activeScion = activeHouse
    ? activeHouse.scions.find(scion => scion.id === requestedScionId) || activeHouse.scions[0] || null
    : null;

  return {
    ok: true,
    state: {
      version: CHRONICLES_SCHEMA_VERSION,
      houses,
      activeHouseId: activeHouse ? activeHouse.id : null,
      activeScionId: activeScion ? activeScion.id : null,
    },
  };
};

export class ChroniclesStore {
  constructor({ storeFile = process.env.CHRONICLES_STORE_FILE || DEFAULT_STORE_FILE, logger = console } = {}) {
    this.storeFile = path.resolve(storeFile);
    this.logger = logger;
    this.state = { version: STORE_SCHEMA_VERSION, accounts: {} };
    this.load();
  }

  load() {
    try {
      if (!fs.existsSync(this.storeFile)) {
        return;
      }
      const parsed = JSON.parse(fs.readFileSync(this.storeFile, 'utf8'));
      if (parsed && typeof parsed === 'object' && parsed.accounts && typeof parsed.accounts === 'object') {
        const accounts = {};
        Object.entries(parsed.accounts).forEach(([accountId, account]) => {
          const sanitised = sanitiseChroniclesState(account && account.state, {
            preserveRelics: true,
            // A server restart destroys transient world drops. Requeue any
            // heirloom that was circulating so it can appear again.
            resetCirculation: true,
          });
          if (!sanitised.ok) {
            return;
          }
          accounts[accountId] = {
            revision: Math.max(1, cleanInteger(account.revision, 1, Number.MAX_SAFE_INTEGER)),
            updatedAt: cleanTimestamp(account.updatedAt, new Date().toISOString()),
            state: sanitised.state,
          };
        });
        this.state = { version: STORE_SCHEMA_VERSION, accounts };
      }
    } catch (error) {
      this.logger.warn(`[chronicles-store] Failed to load state, starting empty. ${error.message}`);
      this.state = { version: STORE_SCHEMA_VERSION, accounts: {} };
    }
  }

  snapshot(accountId) {
    const account = accountId ? this.state.accounts[String(accountId)] : null;
    return {
      exists: Boolean(account),
      revision: account ? account.revision : 0,
      state: account ? clone(account.state) : emptyChroniclesState(),
    };
  }

  persist() {
    const payload = JSON.stringify(this.state, null, 2);
    fs.mkdirSync(path.dirname(this.storeFile), { recursive: true });
    const temporary = `${this.storeFile}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, payload, 'utf8');
    fs.renameSync(temporary, this.storeFile);
  }

  commit(accountId, state) {
    const key = String(accountId);
    const current = this.state.accounts[key];
    const revision = (current ? current.revision : 0) + 1;
    this.state.accounts[key] = {
      revision,
      updatedAt: new Date().toISOString(),
      state,
    };
    try {
      // Chronicle edits are rare and small. Complete the atomic disk rename
      // before acknowledging the mutation so "saved" really means durable.
      this.persist();
    } catch (error) {
      if (current) {
        this.state.accounts[key] = current;
      } else {
        delete this.state.accounts[key];
      }
      this.logger.error(`[chronicles-store] Failed to persist ${key}. ${error.message}`);
      return { ok: false, reason: 'The server could not save this Chronicle.' };
    }
    return { ok: true, exists: true, revision, state: clone(state) };
  }

  save(accountId, candidate) {
    if (!accountId) {
      return { ok: false, reason: 'No authenticated account owns this Chronicles record.' };
    }
    const sanitised = sanitiseChroniclesState(candidate);
    if (!sanitised.ok) {
      return sanitised;
    }

    const key = String(accountId);
    const current = this.state.accounts[key];
    if (current) {
      return {
        ok: false,
        reason: 'This account Chronicle is already server-owned.',
        ...this.snapshot(key),
      };
    }
    return this.commit(key, sanitised.state);
  }

  mutate(accountId, mutation = {}) {
    if (!accountId) {
      return { ok: false, reason: 'No authenticated account owns this Chronicles record.' };
    }
    const key = String(accountId);
    const current = this.snapshot(key);
    const state = current.state;

    if (mutation.type === 'found-house') {
      const house = sanitiseHouse({
        ...(mutation.house || {}),
        renown: 0,
        scions: [],
        crypt: [],
      });
      if (!house) {
        return { ok: false, reason: 'The new House record is invalid.' };
      }
      if (state.houses.length >= MAX_HOUSES) {
        return { ok: false, reason: `An account may record at most ${MAX_HOUSES} Houses.` };
      }
      const duplicate = state.houses.some(entry => (
        entry.id === house.id || entry.name.toLocaleLowerCase() === house.name.toLocaleLowerCase()
      ));
      if (duplicate) {
        return { ok: false, reason: 'That House is already recorded.' };
      }
      return this.commit(key, {
        ...state,
        houses: [...state.houses, house],
        activeHouseId: house.id,
        activeScionId: null,
      });
    }

    if (mutation.type === 'add-scion') {
      const houseId = cleanId(mutation.houseId);
      const house = state.houses.find(entry => entry.id === houseId);
      const newScion = sanitiseScion({
        ...(mutation.scion || {}),
        level: 1,
        diedAt: null,
        deeds: [],
      });
      if (!house || !newScion) {
        return { ok: false, reason: 'The House or new Scion record is invalid.' };
      }
      if (house.scions.length + house.crypt.length >= MAX_SCIONS_PER_HOUSE) {
        return { ok: false, reason: `A House may record at most ${MAX_SCIONS_PER_HOUSE} Scions.` };
      }
      const duplicate = [...house.scions, ...house.crypt].some(entry => (
        entry.id === newScion.id
        || (entry.diedAt === null
          && entry.name.toLocaleLowerCase() === newScion.name.toLocaleLowerCase())
      ));
      if (duplicate) {
        return { ok: false, reason: 'That Scion is already recorded.' };
      }
      const nextHouse = { ...house, scions: [...house.scions, newScion] };
      return this.commit(key, {
        ...state,
        houses: state.houses.map(entry => (entry.id === house.id ? nextHouse : entry)),
        activeHouseId: house.id,
        activeScionId: newScion.id,
      });
    }

    if (mutation.type === 'select-house') {
      const house = state.houses.find(entry => entry.id === cleanId(mutation.houseId));
      if (!house) {
        return { ok: false, reason: 'House not found in this account Chronicle.' };
      }
      return this.commit(key, {
        ...state,
        activeHouseId: house.id,
        activeScionId: house.scions[0] ? house.scions[0].id : null,
      });
    }

    if (mutation.type === 'select-scion') {
      const house = state.houses.find(entry => entry.id === cleanId(mutation.houseId));
      const selected = house && house.scions.find(entry => entry.id === cleanId(mutation.scionId));
      if (!house || !selected) {
        return { ok: false, reason: 'Living Scion not found in this account Chronicle.' };
      }
      return this.commit(key, {
        ...state,
        activeHouseId: house.id,
        activeScionId: selected.id,
      });
    }

    return { ok: false, reason: 'Unknown Chronicles mutation.' };
  }

  findLivingScion(accountId, identity = {}) {
    const snapshot = this.snapshot(accountId);
    const houseId = cleanId(identity.houseId);
    const scionId = cleanId(identity.scionId);
    const house = snapshot.state.houses.find(entry => entry.id === houseId);
    const scion = house && house.scions.find(entry => entry.id === scionId);
    return scion ? { house, scion, snapshot } : null;
  }

  entomb(accountId, identity = {}, details = {}) {
    const key = accountId ? String(accountId) : null;
    const current = key && this.state.accounts[key];
    const houseId = cleanId(identity.houseId);
    const scionId = cleanId(identity.scionId);
    const house = current && current.state.houses.find(entry => entry.id === houseId);
    const scion = house && house.scions.find(entry => entry.id === scionId);
    const alreadyFallen = house && house.crypt.find(entry => entry.id === scionId);
    if (!current || !house || (!scion && !alreadyFallen)) {
      return { ok: false, reason: 'The fallen Scion is not part of this account Chronicle.' };
    }
    if (!scion && alreadyFallen) {
      return {
        ok: true,
        idempotent: true,
        ...this.snapshot(key),
        fallen: clone(alreadyFallen),
      };
    }

    const numericDeath = typeof details.diedAt === 'number' ? new Date(details.diedAt) : null;
    const diedAt = numericDeath && Number.isFinite(numericDeath.getTime())
      ? numericDeath.toISOString()
      : cleanTimestamp(details.diedAt, new Date().toISOString());
    let relic = null;
    const relicItem = buildDurableItemSnapshot(details.relic);
    if (relicItem && cleanId(relicItem.uuid)
      && JSON.stringify(relicItem).length <= MAX_RELIC_BYTES) {
      const relicId = relicItem.uuid;
      relicItem.boundTo = key;
      relicItem.chroniclesRelic = {
        id: relicId,
        houseId: house.id,
        houseName: house.name,
        scionId: scion.id,
        scionName: scion.name,
      };
      relic = {
        id: relicId,
        status: 'queued',
        item: relicItem,
        droppedAt: null,
        recoveredAt: null,
      };
    }
    const fallen = {
      ...scion,
      level: Math.max(1, cleanInteger(details.level, scion.level, MAX_LEVEL)),
      diedAt,
      ...(relic ? { relic } : {}),
    };
    const nextHouse = {
      ...house,
      scions: house.scions.filter(entry => entry.id !== scion.id),
      crypt: [...house.crypt, fallen].slice(-MAX_SCIONS_PER_HOUSE),
    };
    const houses = current.state.houses.map(entry => (entry.id === house.id ? nextHouse : entry));
    const activeScion = nextHouse.scions[0] || null;
    const state = {
      ...current.state,
      houses,
      activeHouseId: house.id,
      activeScionId: activeScion ? activeScion.id : null,
    };
    return { ...this.commit(key, state), fallen: clone(fallen) };
  }

  beginRelicDrop(accountId, identity = {}) {
    const key = accountId ? String(accountId) : null;
    const current = key && this.state.accounts[key];
    const houseId = cleanId(identity.houseId);
    const house = current && current.state.houses.find(entry => entry.id === houseId);
    const fallen = house && house.crypt.find(entry => (
      entry.relic && entry.relic.status === 'queued'
    ));
    if (!current || !house || !fallen) {
      return { ok: false, reason: 'No fallen heirloom is awaiting this House.' };
    }

    const relic = {
      ...fallen.relic,
      status: 'circulating',
      droppedAt: new Date().toISOString(),
      recoveredAt: null,
    };
    const nextFallen = { ...fallen, relic };
    const nextHouse = {
      ...house,
      crypt: house.crypt.map(entry => (entry.id === fallen.id ? nextFallen : entry)),
    };
    const state = {
      ...current.state,
      houses: current.state.houses.map(entry => (entry.id === house.id ? nextHouse : entry)),
    };
    const committed = this.commit(key, state);
    return committed.ok
      ? { ...committed, relic: clone(relic), fallen: clone(nextFallen) }
      : committed;
  }

  recoverRelic(accountId, relicId) {
    const key = accountId ? String(accountId) : null;
    const current = key && this.state.accounts[key];
    const cleanRelicId = cleanId(relicId);
    let matchedHouse = null;
    let matchedScion = null;
    if (current && cleanRelicId) {
      current.state.houses.some((house) => {
        const fallen = house.crypt.find(entry => (
          entry.relic
          && entry.relic.id === cleanRelicId
          && entry.relic.status === 'circulating'
        ));
        if (!fallen) {
          return false;
        }
        matchedHouse = house;
        matchedScion = fallen;
        return true;
      });
    }
    if (!current || !matchedHouse || !matchedScion) {
      return { ok: false, reason: 'That heirloom is not circulating.' };
    }

    const relic = {
      ...matchedScion.relic,
      status: 'recovered',
      droppedAt: null,
      recoveredAt: new Date().toISOString(),
    };
    const nextScion = { ...matchedScion, relic };
    const nextHouse = {
      ...matchedHouse,
      crypt: matchedHouse.crypt.map(entry => (entry.id === matchedScion.id ? nextScion : entry)),
    };
    const state = {
      ...current.state,
      houses: current.state.houses.map(entry => (entry.id === matchedHouse.id ? nextHouse : entry)),
    };
    const committed = this.commit(key, state);
    return committed.ok ? { ...committed, relic: clone(relic) } : committed;
  }

  recordScionDeed(accountId, identity = {}, details = {}) {
    const key = accountId ? String(accountId) : null;
    const current = key && this.state.accounts[key];
    const houseId = cleanId(identity.houseId);
    const scionId = cleanId(identity.scionId);
    const house = current && current.state.houses.find(entry => entry.id === houseId);
    const scion = house && house.scions.find(entry => entry.id === scionId);
    const deed = typeof details.deed === 'string'
      ? details.deed.trim().slice(0, MAX_DEED_LENGTH)
      : '';
    if (!current || !house || !scion || !deed) {
      return { ok: false, reason: 'The deed does not belong to a living Scion.' };
    }
    if (scion.deeds.includes(deed)) {
      return {
        ok: true,
        idempotent: true,
        ...this.snapshot(key),
        scion: clone(scion),
      };
    }

    const renown = cleanInteger(details.renown, 0, MAX_RENOWN);
    const nextScion = {
      ...scion,
      deeds: [...scion.deeds, deed].slice(-MAX_DEEDS_PER_SCION),
    };
    const nextHouse = {
      ...house,
      renown: Math.min(MAX_RENOWN, house.renown + renown),
      scions: house.scions.map(entry => (entry.id === scion.id ? nextScion : entry)),
    };
    const state = {
      ...current.state,
      houses: current.state.houses.map(entry => (entry.id === house.id ? nextHouse : entry)),
    };
    const committed = this.commit(key, state);
    return committed.ok ? { ...committed, scion: clone(nextScion) } : committed;
  }
}

const chroniclesStore = new ChroniclesStore();

export default chroniclesStore;
