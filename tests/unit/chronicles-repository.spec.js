/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChroniclesRepository } from '#server/core/repositories/chronicles-repository.js';

describe('server-side Chronicles repository', () => {
  let repository;
  const accountId = 'account:test';

  beforeEach(() => {
    repository = new ChroniclesRepository({ dbFile: ':memory:' });
  });

  afterEach(() => repository.close());

  const createLineage = () => {
    const founded = repository.foundHouse(accountId, 'Ashford');
    expect(founded.ok).toBe(true);
    const houseId = founded.houseId;
    const created = repository.createScion(accountId, houseId, 'Bryn');
    expect(created.ok).toBe(true);
    return { houseId, scionId: created.scionId };
  };

  it('persists a House and living scion behind an account identity', () => {
    const { houseId, scionId } = createLineage();
    const chronicle = repository.getChronicle(accountId);

    expect(chronicle.activeHouseId).toBe(houseId);
    expect(chronicle.houses[0].name).toBe('Ashford');
    expect(chronicle.houses[0].scions[0]).toMatchObject({ id: scionId, name: 'Bryn', level: 1 });
    expect(repository.getChronicle('account:someone-else').houses).toEqual([]);
  });

  it('normalises a redundant House prefix before storing or presenting a lineage', () => {
    const founded = repository.foundHouse(accountId, 'House Emberveil');

    expect(founded.ok).toBe(true);
    expect(repository.getChronicle(accountId).houses[0].name).toBe('Emberveil');
  });

  it('round-trips a scion snapshot and degrades safely on corrupt JSON', () => {
    const { scionId } = createLineage();
    repository.saveScionSnapshot(accountId, scionId, {
      level: 7,
      inventory: [{ id: 'gold-ring', uuid: 'ring-1' }],
    });
    expect(repository.getLivingScion(accountId, scionId).snapshot.inventory[0].id).toBe('gold-ring');

    repository.db.prepare('UPDATE chronicle_scions SET snapshot_json = ? WHERE id = ?')
      .run('{stale', scionId);
    expect(repository.getLivingScion(accountId, scionId).snapshot).toBeNull();
  });

  it('entombs final death and circulates notable gear after three later runs', () => {
    const { houseId, scionId } = createLineage();
    repository.beginRun(accountId, houseId);
    const burial = repository.entombScion({
      accountId,
      houseId,
      scionId,
      level: 9,
      cause: 'Slain by the Pale Sovereign',
      relicItems: [{ id: 'gold-ring', uuid: 'ring-1', name: 'Sun-Bound Ring' }],
    });

    expect(burial.relicCount).toBe(1);
    expect(repository.getLivingScion(accountId, scionId)).toBeNull();
    expect(repository.getChronicle(accountId).houses[0].crypt[0]).toMatchObject({
      name: 'Bryn', level: 9, relics: ['Sun-Bound Ring'],
    });
    expect(repository.drawEligibleRelic([accountId])).toBeNull();

    repository.beginRun(accountId, houseId);
    repository.beginRun(accountId, houseId);
    expect(repository.drawEligibleRelic([accountId])).toBeNull();
    repository.beginRun(accountId, houseId);

    const relic = repository.drawEligibleRelic([accountId]);
    expect(relic.item).toMatchObject({ id: 'gold-ring', uuid: 'ring-1' });
    expect(relic.originScionName).toBe('Bryn');
    expect(repository.claimRelic(relic.id, { scionId: 'later-scion' })).toBe(true);
    expect(repository.drawEligibleRelic([accountId])).toBeNull();
  });

  it('rejects invalid names and cross-account scion access', () => {
    expect(repository.foundHouse(accountId, 'x').ok).toBe(false);
    const { houseId, scionId } = createLineage();
    expect(repository.createScion('account:intruder', houseId, 'Vesper').ok).toBe(false);
    expect(repository.getLivingScion('account:intruder', scionId)).toBeNull();
  });

  it('records personal and House depth records without allowing regressions', () => {
    const { houseId, scionId } = createLineage();
    expect(repository.recordDepth(accountId, houseId, scionId, 4)).toBe(4);
    expect(repository.recordDepth(accountId, houseId, scionId, 2)).toBe(2);

    const chronicle = repository.getChronicle(accountId);
    expect(chronicle.bestDepth).toBe(4);
    expect(chronicle.houses[0].bestDepth).toBe(4);
    expect(chronicle.houses[0].scions[0].bestDepth).toBe(4);
    expect(chronicle.houses[0].treasury).toBe(100);
    expect(chronicle.leaderboard[0]).toMatchObject({ houseName: 'Ashford', bestDepth: 4 });
    expect(repository.recordDepth('account:intruder', houseId, scionId, 99)).toBeNull();
  });

  it('funds persistent House development through daily gold and depth gains', () => {
    const { houseId, scionId } = createLineage();
    const daily = repository.claimDailyGold(accountId, houseId);
    expect(daily).toMatchObject({ ok: true, amount: 100 });
    expect(repository.claimDailyGold(accountId, houseId).ok).toBe(false);
    repository.recordDepth(accountId, houseId, scionId, 6);

    let house = repository.getChronicle(accountId).houses[0];
    expect(house.treasury).toBe(250);
    expect(house.dailyClaimAvailable).toBe(false);
    expect(repository.upgradeHouse(accountId, houseId, 'hall').ok).toBe(true);
    house = repository.getChronicle(accountId).houses[0];
    expect(house.treasury).toBe(0);
    expect(house.upgrades.hall).toBe(1);
    expect(house.dailyGold).toBe(125);
  });

  it('atomically deposits a living scion snapshot and carried gold into their House', () => {
    const { houseId, scionId } = createLineage();
    const snapshot = {
      level: 3,
      inventory: [{ id: 'coins', uuid: 'coins-left', qty: 25, slot: 0 }],
    };

    expect(repository.depositScionGold(accountId, houseId, scionId, 175, snapshot))
      .toMatchObject({ ok: true, amount: 175, treasury: 175 });
    expect(repository.getChronicle(accountId).houses[0].treasury).toBe(175);
    expect(repository.getLivingScion(accountId, scionId).snapshot).toEqual(snapshot);

    expect(repository.depositScionGold('account:intruder', houseId, scionId, 100, snapshot).ok)
      .toBe(false);
    expect(repository.depositScionGold(accountId, houseId, scionId, 0, snapshot).ok)
      .toBe(false);
    expect(repository.getChronicle(accountId).houses[0].treasury).toBe(175);
  });

  it('lets a death witness find the friend House relic after three of their runs', () => {
    const { houseId, scionId } = createLineage();
    repository.beginRun(accountId, houseId);
    repository.entombScion({
      accountId,
      houseId,
      scionId,
      level: 5,
      relicItems: [{ id: 'gold-ring', uuid: 'friend-ring', name: 'Bryn\'s Ring' }],
    });

    const friendAccount = 'account:friend';
    const friendHouse = repository.foundHouse(friendAccount, 'Wayfarers');
    const friendScion = repository.createScion(friendAccount, friendHouse.houseId, 'Mara');
    repository.beginRun(friendAccount, friendHouse.houseId);
    expect(repository.grantHouseRelicAccess(friendAccount, houseId, 3)).toBe(4);
    repository.beginRun(friendAccount, friendHouse.houseId);
    repository.beginRun(friendAccount, friendHouse.houseId);
    expect(repository.drawEligibleRelic([friendAccount])).toBeNull();
    repository.beginRun(friendAccount, friendHouse.houseId);
    expect(repository.drawEligibleRelic([friendAccount])).toMatchObject({
      originScionName: 'Bryn',
      item: { uuid: 'friend-ring' },
    });
    expect(friendScion.ok).toBe(true);
  });
});
