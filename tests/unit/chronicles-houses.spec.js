/** @vitest-environment node */

import {
  describe, expect, it, beforeEach,
} from 'vitest';

// jsdom is not installed in this project, so provide a tiny in-memory
// localStorage on a global window before importing the module under test.
const createLocalStorageStub = () => {
  const store = new Map();
  return {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => { store.clear(); },
  };
};

globalThis.window = { localStorage: createLocalStorageStub() };

const houses = await import('@/core/chronicles/houses.js');
const {
  loadHouses,
  saveHouses,
  foundHouse,
  addScion,
  entombScion,
  getActiveHouse,
  validateHouseName,
  validateScionName,
  STORAGE_KEY,
} = houses;

describe('Chronicles houses persistence', () => {
  beforeEach(() => {
    globalThis.window = { localStorage: createLocalStorageStub() };
  });

  it('returns an empty state when nothing is stored', () => {
    const state = loadHouses();
    expect(state.houses).toEqual([]);
    expect(state.activeHouseId).toBeNull();
  });

  it('validates house and scion names', () => {
    expect(validateHouseName('ab').valid).toBe(false);
    expect(validateHouseName('Vaelmont').valid).toBe(true);
    expect(validateHouseName('x'.repeat(30)).valid).toBe(false);
    expect(validateScionName('a').valid).toBe(false);
    expect(validateScionName('Orun').valid).toBe(true);
  });

  it('founds a house and makes it active', () => {
    const result = foundHouse(loadHouses(), 'Druskane');
    expect(result.ok).toBe(true);
    expect(result.house.name).toBe('Druskane');
    expect(result.state.activeHouseId).toBe(result.house.id);
    expect(getActiveHouse(result.state).name).toBe('Druskane');
  });

  it('rejects an invalid house name', () => {
    const result = foundHouse(loadHouses(), 'x');
    expect(result.ok).toBe(false);
    expect(result.state.houses).toHaveLength(0);
  });

  it('adds scions to a house', () => {
    const founded = foundHouse(loadHouses(), 'Morvayne');
    const withScion = addScion(founded.state, founded.house.id, 'Orun');
    expect(withScion.ok).toBe(true);
    expect(getActiveHouse(withScion.state).scions).toHaveLength(1);
    expect(withScion.scion.name).toBe('Orun');
  });

  it('entombs a dead scion into the crypt', () => {
    const founded = foundHouse(loadHouses(), 'Ashford');
    const withScion = addScion(founded.state, founded.house.id, 'Bryn');
    const buried = entombScion(withScion.state, founded.house.id, withScion.scion.id, { level: 7 });

    expect(buried.ok).toBe(true);
    const house = getActiveHouse(buried.state);
    expect(house.scions).toHaveLength(0);
    expect(house.crypt).toHaveLength(1);
    expect(house.crypt[0].name).toBe('Bryn');
    expect(house.crypt[0].level).toBe(7);
    expect(house.crypt[0].diedAt).toBeTruthy();
  });

  it('round-trips through localStorage and migrates legacy shapes', () => {
    const founded = foundHouse(loadHouses(), 'Thornholt');
    const withScion = addScion(founded.state, founded.house.id, 'Vesper');
    expect(saveHouses(withScion.state)).toBe(true);

    const reloaded = loadHouses();
    expect(reloaded.houses).toHaveLength(1);
    expect(reloaded.houses[0].name).toBe('Thornholt');
    expect(reloaded.houses[0].scions[0].name).toBe('Vesper');
    expect(reloaded.activeHouseId).toBe(founded.house.id);
  });

  it('recovers from corrupt storage', () => {
    window.localStorage.setItem(STORAGE_KEY, '{ not valid json');
    const state = loadHouses();
    expect(state.houses).toEqual([]);
  });

  it('backfills missing fields on legacy houses', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      houses: [{ name: 'Greyford' }],
      activeHouseId: 'gone',
    }));
    const state = loadHouses();
    expect(state.houses[0].renown).toBe(0);
    expect(Array.isArray(state.houses[0].scions)).toBe(true);
    expect(Array.isArray(state.houses[0].crypt)).toBe(true);
    // active id fell back to the only house
    expect(state.activeHouseId).toBe(state.houses[0].id);
  });
});
