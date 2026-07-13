/** A scion can turn carried dungeon gold into persistent House development funds. */
export default async function houseTreasury({ connect, assert }) {
  const guestId = 'playtest-house-treasury';
  const p = await connect({
    guestId,
    houseName: 'Ledger',
    scionName: 'Tala Testborn',
  });
  let p2;
  try {
    const initial = await p.state();
    const coinsBefore = initial.inventory
      .filter(item => item.id === 'coins')
      .reduce((sum, item) => sum + item.qty, 0);
    assert(coinsBefore >= 100, 'the scion has carried gold available for a House deposit');

    const banker = initial.npcs.find(npc => npc.name === 'Rhea of the Countinghouse');
    assert(banker, 'the Crossroads exposes a clearly named countinghouse keeper');
    p.devTeleport(banker.x, banker.y + 1);
    await p.waitFor(async () => (await p.state()).y === banker.y + 1, {
      label: 'House banker approach',
    });
    const menu = await p.rightClick(banker.x, banker.y);
    const bank = menu.find(entry => entry.action?.actionId === 'player:screen:bank');
    assert(bank, 'the House banker exposes the Bank action');
    p.choose(bank, { x: 0, y: 0, world: { x: banker.x, y: banker.y } });

    const opened = await p.waitFor(() => p.screens.find(screen => screen.screen === 'bank'), {
      label: 'House treasury bank pane',
    });
    assert(opened.payload?.house?.name === 'Ledger',
      `bank identifies the active House (${opened.payload?.house?.name || 'missing'})`);
    const treasuryBefore = opened.payload.house.treasury;
    assert(opened.payload.carriedCoins === coinsBefore, 'bank shows the scion carried-gold balance');

    p.emit('chronicles:house:deposit', { amount: 100 });
    const deposited = await p.waitFor(() => p.screens.findLast(screen => (
      screen.screen === 'bank'
      && screen.payload?.house?.treasury === treasuryBefore + 100
    )), { label: 'House deposit confirmation' });
    assert(deposited.payload.carriedCoins === coinsBefore - 100, 'bank refreshes the reduced carried balance');
    const after = await p.state();
    const coinsAfter = after.inventory
      .filter(item => item.id === 'coins')
      .reduce((sum, item) => sum + item.qty, 0);
    assert(coinsAfter === coinsBefore - 100, 'deposit removes exactly 100 gold from the scion');
    assert(p.messages.some(message => /100 gold nailed under the boards.*House Ledger/i.test(message)),
      'deposit reports the exact House transfer');

    p.close();
    p2 = await connect({ guestId, houseName: 'Ledger', scionName: 'Tala Testborn' });
    const persistedHouse = p2.chronicle.houses.find(house => house.name === 'Ledger');
    assert(persistedHouse?.treasury === treasuryBefore + 100, 'House treasury survives a new session');
    const persisted = await p2.state();
    const persistedCoins = persisted.inventory
      .filter(item => item.id === 'coins')
      .reduce((sum, item) => sum + item.qty, 0);
    assert(persistedCoins === coinsBefore - 100, 'the scion cannot recover deposited gold by relogging');
  } finally {
    if (!p.closed) p.close();
    if (p2 && !p2.closed) p2.close();
  }
}
