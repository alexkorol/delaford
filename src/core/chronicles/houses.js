/**
 * Chronicles — Houses & Scions (client persistence).
 *
 * The account-level meta-layer ported from the WIZARD rp_account_creator:
 * an account is a **House** (persistent, accrues renown), and characters are
 * **scions** who adventure under the House name. When a scion dies for good
 * they pass into the House **crypt**, seeding future legacy. No classes — a
 * scion is a blank identity; the House is the throughline.
 *
 * Pure data + localStorage; safe to unit-test with a mocked storage.
 */

import {
  validateHouseName,
  validateScionName,
} from '@shared/chronicles.js';

export { validateHouseName, validateScionName };

export const STORAGE_KEY = 'verdigris_houses';
const SCHEMA_VERSION = 2;

const now = () => new Date().toISOString();

const randomId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const getStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
};

const migrateHouse = (house = {}) => ({
  id: house.id || randomId('house'),
  name: typeof house.name === 'string' ? house.name : 'Nameless House',
  renown: Number.isFinite(house.renown) ? house.renown : 0,
  foundedAt: house.foundedAt || now(),
  scions: Array.isArray(house.scions) ? house.scions.map(migrateScion) : [],
  crypt: Array.isArray(house.crypt) ? house.crypt.map(migrateScion) : [],
});

const migrateScion = (scion = {}) => ({
  id: scion.id || randomId('scion'),
  name: typeof scion.name === 'string' ? scion.name : 'Unnamed',
  level: Number.isFinite(scion.level) ? scion.level : 1,
  bornAt: scion.bornAt || now(),
  diedAt: scion.diedAt || null,
  deeds: Array.isArray(scion.deeds) ? scion.deeds : [],
});

const emptyState = () => ({
  version: SCHEMA_VERSION,
  houses: [],
  activeHouseId: null,
  activeScionId: null,
});

/**
 * Load and migrate the saved Chronicles state. Never throws — corrupt or
 * missing data yields a fresh empty state.
 */
export const loadHouses = () => {
  const storage = getStorage();
  if (!storage) {
    return emptyState();
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyState();
    }
    const parsed = JSON.parse(raw);
    const houses = Array.isArray(parsed.houses) ? parsed.houses.map(migrateHouse) : [];
    const activeHouseId = houses.some(house => house.id === parsed.activeHouseId)
      ? parsed.activeHouseId
      : (houses[0] ? houses[0].id : null);
    const activeHouse = houses.find(house => house.id === activeHouseId) || null;
    const activeScionId = activeHouse && activeHouse.scions.some(scion => scion.id === parsed.activeScionId)
      ? parsed.activeScionId
      : (activeHouse && activeHouse.scions[0] ? activeHouse.scions[0].id : null);
    return {
      version: SCHEMA_VERSION,
      houses,
      activeHouseId,
      activeScionId,
    };
  } catch (error) {
    console.warn('[chronicles] Failed to load houses; starting fresh.', error);
    return emptyState();
  }
};

export const saveHouses = (state) => {
  const storage = getStorage();
  if (!storage) {
    return false;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: SCHEMA_VERSION,
      houses: Array.isArray(state.houses) ? state.houses : [],
      activeHouseId: state.activeHouseId || null,
      activeScionId: state.activeScionId || null,
    }));
    return true;
  } catch (error) {
    console.warn('[chronicles] Failed to save houses.', error);
    return false;
  }
};

export const foundHouse = (state, name) => {
  const validation = validateHouseName(name);
  if (!validation.valid) {
    return { ok: false, reason: validation.reason, state };
  }
  const duplicate = state.houses.some(house => (
    house.name.toLocaleLowerCase() === validation.value.toLocaleLowerCase()
  ));
  if (duplicate) {
    return { ok: false, reason: 'A House with that name is already recorded.', state };
  }
  const house = migrateHouse({ name: validation.value });
  const next = {
    ...state,
    houses: [...state.houses, house],
    activeHouseId: house.id,
    activeScionId: null,
  };
  return { ok: true, state: next, house };
};

export const addScion = (state, houseId, name) => {
  const validation = validateScionName(name);
  if (!validation.valid) {
    return { ok: false, reason: validation.reason, state };
  }
  const house = state.houses.find(entry => entry.id === houseId);
  if (!house) {
    return { ok: false, reason: 'House not found.', state };
  }
  const duplicate = house.scions.some(scion => (
    scion.name.toLocaleLowerCase() === validation.value.toLocaleLowerCase()
  ));
  if (duplicate) {
    return { ok: false, reason: 'That name already belongs to a living Scion.', state };
  }
  const scion = migrateScion({ name: validation.value });
  const nextHouse = { ...house, scions: [...house.scions, scion] };
  const next = {
    ...state,
    houses: state.houses.map(entry => (entry.id === houseId ? nextHouse : entry)),
    activeHouseId: houseId,
    activeScionId: scion.id,
  };
  return { ok: true, state: next, scion };
};

export const selectHouse = (state, houseId) => {
  const house = state.houses.find(entry => entry.id === houseId);
  if (!house) {
    return { ok: false, reason: 'House not found.', state };
  }

  return {
    ok: true,
    state: {
      ...state,
      activeHouseId: house.id,
      activeScionId: house.scions[0] ? house.scions[0].id : null,
    },
    house,
  };
};

export const selectScion = (state, scionId) => {
  const house = state.houses.find(entry => entry.id === state.activeHouseId);
  const scion = house && house.scions.find(entry => entry.id === scionId);
  if (!scion) {
    return { ok: false, reason: 'Living scion not found.', state };
  }

  return {
    ok: true,
    state: { ...state, activeScionId: scion.id },
    scion,
  };
};

/**
 * A scion dies for good: move it from the living roster into the crypt with
 * its death timestamp and level. The House keeps the memory (and future
 * relic circulation will draw from the crypt).
 */
export const entombScion = (state, houseId, scionId, details = {}) => {
  const house = state.houses.find(entry => entry.id === houseId);
  if (!house) {
    return { ok: false, reason: 'House not found.', state };
  }
  const scion = house.scions.find(entry => entry.id === scionId);
  if (!scion) {
    return { ok: false, reason: 'Scion not found.', state };
  }
  const fallen = {
    ...scion,
    level: Number.isFinite(details.level) ? details.level : scion.level,
    diedAt: details.diedAt || now(),
  };
  const nextHouse = {
    ...house,
    scions: house.scions.filter(entry => entry.id !== scionId),
    crypt: [...house.crypt, fallen],
  };
  const next = {
    ...state,
    houses: state.houses.map(entry => (entry.id === houseId ? nextHouse : entry)),
    activeScionId: state.activeScionId === scionId
      ? (nextHouse.scions[0] ? nextHouse.scions[0].id : null)
      : state.activeScionId,
  };
  return { ok: true, state: next, fallen };
};

export const getActiveHouse = state => (
  state.houses.find(house => house.id === state.activeHouseId) || null
);

export const getActiveScion = (state) => {
  const house = getActiveHouse(state);
  return (house && house.scions.find(scion => scion.id === state.activeScionId)) || null;
};

export default {
  STORAGE_KEY,
  loadHouses,
  saveHouses,
  foundHouse,
  addScion,
  selectHouse,
  selectScion,
  entombScion,
  getActiveHouse,
  getActiveScion,
  validateHouseName,
  validateScionName,
};
