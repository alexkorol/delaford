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
const MAX_MIGRATION_BYTES = 12 * 1024;
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;

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

const sanitiseScion = (candidate, { fallen = false } = {}) => {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }
  const id = cleanId(candidate.id);
  const validation = validateScionName(candidate.name);
  if (!id || !validation.valid) {
    return null;
  }

  const diedAt = cleanTimestamp(candidate.diedAt, fallen ? new Date().toISOString() : null);

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

const sanitiseHouse = (candidate) => {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }
  const id = cleanId(candidate.id);
  const validation = validateHouseName(candidate.name);
  const scions = sanitiseScions(candidate.scions);
  const crypt = sanitiseScions(candidate.crypt, { fallen: true });
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

export const sanitiseChroniclesState = (candidate) => {
  if (!candidate || typeof candidate !== 'object' || !Array.isArray(candidate.houses)
    || candidate.houses.length > MAX_HOUSES
    || JSON.stringify(candidate).length > MAX_MIGRATION_BYTES) {
    return { ok: false, reason: 'The Chronicles record has an invalid shape.' };
  }

  const houses = candidate.houses.map(sanitiseHouse);
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
          const sanitised = sanitiseChroniclesState(account && account.state);
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
    if (!current || !house || !scion) {
      return { ok: false, reason: 'The fallen Scion is not part of this account Chronicle.' };
    }

    const numericDeath = typeof details.diedAt === 'number' ? new Date(details.diedAt) : null;
    const diedAt = numericDeath && Number.isFinite(numericDeath.getTime())
      ? numericDeath.toISOString()
      : cleanTimestamp(details.diedAt, new Date().toISOString());
    const fallen = {
      ...scion,
      level: Math.max(1, cleanInteger(details.level, scion.level, MAX_LEVEL)),
      diedAt,
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
}

const chroniclesStore = new ChroniclesStore();

export default chroniclesStore;
