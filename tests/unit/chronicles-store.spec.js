/** @vitest-environment node */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { ChroniclesStore } from '#server/core/services/chronicles-store.js';

const temporaryDirectories = [];
const makeStore = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'verdigris-chronicles-test-'));
  temporaryDirectories.push(directory);
  return new ChroniclesStore({
    storeFile: path.join(directory, 'chronicles.json'),
    logger: { warn: vi.fn(), error: vi.fn() },
  });
};

const scion = (id, name, overrides = {}) => ({
  id,
  name,
  level: 1,
  bornAt: '2026-01-01T00:00:00.000Z',
  diedAt: null,
  deeds: [],
  mortal: false,
  ...overrides,
});

const state = ({
  living = [scion('scion-vesper', 'Vesper')],
  crypt = [],
  renown = 0,
} = {}) => ({
  version: 3,
  houses: [{
    id: 'house-vaelmont',
    name: 'Vaelmont',
    renown,
    foundedAt: '2026-01-01T00:00:00.000Z',
    scions: living,
    crypt,
  }],
  activeHouseId: 'house-vaelmont',
  activeScionId: living[0] ? living[0].id : null,
});

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => {
    fs.rmSync(directory, { recursive: true, force: true });
  });
});

describe('ChroniclesStore', () => {
  it('seeds a legacy browser record once and survives a disk reload', () => {
    const store = makeStore();
    const fallen = scion('scion-morrow', 'Morrow', {
      level: 9,
      mortal: true,
      diedAt: '2026-02-01T00:00:00.000Z',
    });
    const saved = store.save('account-1', state({ crypt: [fallen], renown: 41 }));

    expect(saved.ok).toBe(true);
    expect(saved.revision).toBe(1);
    expect(saved.state.houses[0].crypt[0].name).toBe('Morrow');
    expect(saved.state.houses[0].renown).toBe(41);
    const reloaded = new ChroniclesStore({
      storeFile: store.storeFile,
      logger: { warn: vi.fn(), error: vi.fn() },
    });
    expect(reloaded.snapshot('account-1')).toEqual(expect.objectContaining({
      exists: true,
      revision: 1,
      state: expect.objectContaining({ activeScionId: 'scion-vesper' }),
    }));
  });

  it('accepts a legacy seed only once and rejects later whole-record rewrites', () => {
    const store = makeStore();
    const fallen = scion('scion-morrow', 'Morrow', {
      level: 9,
      mortal: true,
      diedAt: '2026-02-01T00:00:00.000Z',
    });
    store.save('account-1', state({ crypt: [fallen], renown: 41 }));

    const forged = state({
      living: [
        scion('scion-morrow', 'Morrow'),
        scion('scion-sable', 'Sable'),
      ],
      crypt: [],
      renown: 999999,
    });
    forged.activeScionId = 'scion-sable';
    const rejected = store.save('account-1', forged);
    const snapshot = store.snapshot('account-1');
    const house = snapshot.state.houses[0];

    expect(rejected.ok).toBe(false);
    expect(house.renown).toBe(41);
    expect(house.crypt.map(entry => entry.id)).toEqual(['scion-morrow']);
    expect(house.scions.map(entry => entry.id)).toEqual(['scion-vesper']);
  });

  it('builds new records through bounded mutations', () => {
    const store = makeStore();
    const founded = store.mutate('account-2', {
      type: 'found-house',
      house: {
        id: 'house-dusk',
        name: 'Duskward',
        foundedAt: '2026-03-01T00:00:00.000Z',
      },
    });
    const added = store.mutate('account-2', {
      type: 'add-scion',
      houseId: 'house-dusk',
      scion: scion('scion-sable', 'Sable', { level: 80, mortal: true }),
    });

    expect(founded).toEqual(expect.objectContaining({ ok: true, revision: 1 }));
    expect(added).toEqual(expect.objectContaining({ ok: true, revision: 2 }));
    expect(added.state.houses[0]).toEqual(expect.objectContaining({
      renown: 0,
      crypt: [],
    }));
    expect(added.state.houses[0].scions[0]).toEqual(expect.objectContaining({
      id: 'scion-sable',
      name: 'Sable',
      level: 1,
      mortal: true,
      deeds: [],
    }));
    expect(added.state.activeScionId).toBe('scion-sable');
  });

  it('entombs a living Scion authoritatively and prevents reselection', () => {
    const store = makeStore();
    store.save('account-1', state({
      living: [scion('scion-morrow', 'Morrow', { mortal: true })],
    }));

    const result = store.entomb('account-1', {
      houseId: 'house-vaelmont',
      scionId: 'scion-morrow',
    }, {
      level: 12,
      diedAt: 1770000000000,
    });

    expect(result.ok).toBe(true);
    expect(result.revision).toBe(2);
    expect(result.state.houses[0].scions).toEqual([]);
    expect(result.state.houses[0].crypt[0]).toEqual(expect.objectContaining({
      id: 'scion-morrow',
      level: 12,
      mortal: true,
    }));
    expect(store.findLivingScion('account-1', {
      houseId: 'house-vaelmont',
      scionId: 'scion-morrow',
    })).toBeNull();
  });

  it('drops malformed account records instead of throwing during load', () => {
    const store = makeStore();
    fs.mkdirSync(path.dirname(store.storeFile), { recursive: true });
    fs.writeFileSync(store.storeFile, JSON.stringify({
      accounts: {
        broken: { revision: 7, state: { houses: 'not-an-array' } },
      },
    }));

    const reloaded = new ChroniclesStore({
      storeFile: store.storeFile,
      logger: { warn: vi.fn(), error: vi.fn() },
    });
    expect(reloaded.snapshot('broken')).toEqual({
      exists: false,
      revision: 0,
      state: {
        version: 3,
        houses: [],
        activeHouseId: null,
        activeScionId: null,
      },
    });
  });

  it('does not acknowledge or retain a mutation when the atomic write fails', () => {
    const store = makeStore();
    vi.spyOn(store, 'persist').mockImplementation(() => {
      throw new Error('disk full');
    });

    const result = store.mutate('account-failed', {
      type: 'found-house',
      house: { id: 'house-failed', name: 'Failward' },
    });

    expect(result).toEqual({
      ok: false,
      reason: 'The server could not save this Chronicle.',
    });
    expect(store.snapshot('account-failed').exists).toBe(false);
  });
});
