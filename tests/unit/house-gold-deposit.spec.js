/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import chroniclesRepository from '#server/core/repositories/chronicles-repository.js';
import Socket from '#server/socket.js';
import world from '#server/core/world.js';
import chronicleEvents from '#server/player/handlers/chronicles.js';

const makeLineage = (suffix) => {
  const accountId = `account:deposit-${suffix}`;
  const founded = chroniclesRepository.foundHouse(accountId, `Deposit ${suffix}`);
  const created = chroniclesRepository.createScion(accountId, founded.houseId, `Scion ${suffix}`);
  return { accountId, houseId: founded.houseId, scionId: created.scionId };
};

const makePlayer = ({ accountId, houseId, scionId }, overrides = {}) => ({
  uuid: scionId,
  scionId,
  accountId,
  houseId,
  houseName: 'Deposit House',
  username: 'Coin Bearer',
  socket_id: `socket-${scionId}`,
  sceneId: world.defaultTownId,
  currentPane: 'bank',
  x: 31,
  y: 122,
  level: 1,
  skills: {},
  wear: {},
  bank: [],
  inventory: {
    slots: [
      { id: 'coins', uuid: 'coin-a', qty: 80, slot: 0 },
      { id: 'coins', uuid: 'coin-b', qty: 70, slot: 1 },
    ],
  },
  stats: {
    lifecycle: { mode: 'hard', state: 'alive' },
    resources: {},
  },
  ...overrides,
});

describe('scion gold to House treasury', () => {
  beforeEach(() => {
    vi.spyOn(Socket, 'emit').mockImplementation(() => true);
    world._players = [];
    world.getDefaultTown().players = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    world._players = [];
    world.getDefaultTown().players = [];
  });

  it('deposits across carried stacks and persists the reduced scion snapshot', () => {
    const lineage = makeLineage('One');
    const player = makePlayer(lineage);
    world.addPlayer(player);

    chronicleEvents['chronicles:house:deposit'](
      { data: { amount: 100 } },
      { id: player.socket_id },
    );

    expect(player.inventory.slots).toEqual([
      expect.objectContaining({ id: 'coins', qty: 50 }),
    ]);
    const house = chroniclesRepository.getChronicle(lineage.accountId).houses[0];
    expect(house.treasury).toBe(100);
    expect(chroniclesRepository.getLivingScion(lineage.accountId, lineage.scionId).snapshot.inventory)
      .toEqual([expect.objectContaining({ id: 'coins', qty: 50 })]);
    expect(Socket.emit).toHaveBeenCalledWith('open:screen', expect.objectContaining({
      screen: 'bank',
      payload: expect.objectContaining({
        carriedCoins: 50,
        house: expect.objectContaining({ treasury: 100 }),
      }),
    }));
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      text: '100 gold nailed under the boards: from Coin Bearer to House Deposit One.',
    }));
  });

  it('requires a town bank or wagon pane and leaves both balances unchanged otherwise', () => {
    const lineage = makeLineage('Two');
    const player = makePlayer(lineage, { currentPane: 'shop' });
    world.addPlayer(player);

    chronicleEvents['chronicles:house:deposit'](
      { data: { amount: 'all' } },
      { id: player.socket_id },
    );

    expect(player.inventory.slots.reduce((sum, item) => sum + item.qty, 0)).toBe(150);
    expect(chroniclesRepository.getChronicle(lineage.accountId).houses[0].treasury).toBe(0);
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      text: 'Deposit House gold at your wagon or the countinghouse at the Crossroads.',
    }));
  });

  it('accepts deposits from the wagon pane and reopens the wagon screen', () => {
    const lineage = makeLineage('Three');
    const player = makePlayer(lineage, { currentPane: 'wagon' });
    world.addPlayer(player);

    chronicleEvents['chronicles:house:deposit'](
      { data: { amount: 'all' } },
      { id: player.socket_id },
    );

    expect(player.inventory.slots).toEqual([]);
    expect(chroniclesRepository.getChronicle(lineage.accountId).houses[0].treasury).toBe(150);
    expect(Socket.emit).toHaveBeenCalledWith('open:screen', expect.objectContaining({
      screen: 'wagon',
      payload: expect.objectContaining({
        house: expect.objectContaining({ treasury: 150 }),
      }),
    }));
  });
});
