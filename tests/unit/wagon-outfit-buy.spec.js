/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Socket from '#server/socket.js';
import world from '#server/core/world.js';
import Query from '#server/core/data/query.js';
import chroniclesRepository from '#server/core/repositories/chronicles-repository.js';
import wagonEvents from '#server/player/handlers/wagon.js';
import { wagonNpcId } from '#server/core/services/wagon-service.js';

const makeLineage = (suffix) => {
  const accountId = `account:wagon-${suffix}`;
  const founded = chroniclesRepository.foundHouse(accountId, `Wagons ${suffix}`);
  const created = chroniclesRepository.createScion(accountId, founded.houseId, `Scion ${suffix}`);
  chroniclesRepository.recordDepth(accountId, founded.houseId, created.scionId, 10);
  return { accountId, houseId: founded.houseId, scionId: created.scionId };
};

const treasuryOf = accountId => chroniclesRepository.getChronicle(accountId).houses[0].treasury;

describe('wagon outfit purchase atomicity (cand-009)', () => {
  let player;
  let lineage;
  const itemId = 'bronze-sword';
  const price = Math.max(1, Query.getItemData(itemId).price || 0);

  const setup = (addImpl, suffix) => {
    lineage = makeLineage(suffix);
    player = {
      uuid: lineage.scionId,
      scionId: lineage.scionId,
      accountId: lineage.accountId,
      houseId: lineage.houseId,
      socket_id: `socket-${lineage.scionId}`,
      sceneId: world.defaultTownId,
      currentPane: 'wagon',
      x: 40,
      y: 41,
      inventory: { slots: [], add: addImpl },
    };
    world.getDefaultTown().npcs = [{ id: wagonNpcId(lineage.houseId), x: 40, y: 40 }];
    world.addPlayer(player);
  };

  const buy = () => wagonEvents['wagon:outfit:buy'](
    { data: { itemId } },
    { id: player.socket_id },
  );

  beforeEach(() => {
    vi.spyOn(Socket, 'emit').mockImplementation(() => {});
    world._players = [];
    world.clients = [];
    const town = world.getDefaultTown();
    town.players = [];
    town.npcs = [];
    town.items = [];
    town.type = 'town';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    world._players = [];
    world.getDefaultTown().players = [];
    world.getDefaultTown().npcs = [];
  });

  it('delivers the goods and debits the treasury on a successful purchase', async () => {
    const add = vi.fn(() => ({ ok: true, added: 1, remainder: 0 }));
    setup(add, 'Success');
    const before = treasuryOf(lineage.accountId);

    await buy();

    expect(add).toHaveBeenCalledWith(itemId, 1, { overflow: 'reject' });
    expect(treasuryOf(lineage.accountId)).toBe(before - price);
    expect(Socket.emit).toHaveBeenCalledWith('core:refresh:inventory', expect.objectContaining({
      player: { socket_id: player.socket_id },
    }));
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      text: expect.stringContaining('hands over'),
    }));
  });

  it('refunds the treasury when the backpack is full (silent add failure)', async () => {
    const add = vi.fn(() => ({ ok: false, added: 0, remainder: 1 }));
    setup(add, 'Full');
    const before = treasuryOf(lineage.accountId);

    await buy();

    expect(add).toHaveBeenCalledWith(itemId, 1, { overflow: 'reject' });
    expect(treasuryOf(lineage.accountId)).toBe(before);
    expect(Socket.emit).not.toHaveBeenCalledWith('core:refresh:inventory', expect.anything());
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      text: 'Your backpack cannot hold that; the quartermaster leaves the ledger untouched.',
    }));
    expect(Socket.emit).not.toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      text: expect.stringContaining('hands over'),
    }));
  });

  it('refunds the treasury when inventory.add throws', async () => {
    const add = vi.fn(() => { throw new Error('factory exploded'); });
    setup(add, 'Throw');
    const before = treasuryOf(lineage.accountId);

    await expect(buy()).resolves.toBeUndefined();

    expect(treasuryOf(lineage.accountId)).toBe(before);
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      text: 'Your backpack cannot hold that; the quartermaster leaves the ledger untouched.',
    }));
  });

  it('still refuses the purchase when the ledger cannot cover the price', async () => {
    const add = vi.fn(() => ({ ok: true, added: 1, remainder: 0 }));
    setup(add, 'Broke');
    const house = chroniclesRepository.getChronicle(lineage.accountId).houses[0];
    chroniclesRepository.spendHouseTreasury(lineage.accountId, lineage.houseId, house.treasury);

    await buy();

    expect(add).not.toHaveBeenCalled();
    expect(treasuryOf(lineage.accountId)).toBe(0);
    expect(Socket.emit).toHaveBeenCalledWith('game:send:message', expect.objectContaining({
      text: expect.stringContaining('ledger holds only'),
    }));
  });
});
