/**
 * The Crossroads contract (docs/crossroads-world-web.md): a scion logs in at
 * their House's wagon pitch, the day's road purse auto-claims into the House
 * ledger, the town is sanctuary ground, and the wagon pane supports deposits
 * and treasury-funded outfitting.
 */
export default async function crossroads({ connect, assert }) {
  const p = await connect({
    guestId: `playtest-crossroads-${Date.now()}`,
    houseName: 'House Waymark',
    scionName: 'Pitch Testborn',
  });
  try {
    const s = await p.state();
    assert(s.sceneType === 'town', 'a scion begins at the Crossroads');
    assert(s.sceneMetadata.sanctuary === true, 'the Crossroads is truce-ground (sanctuary metadata)');
    // Regression: legacy static monsters spawned INTO the town scene and an
    // Ashen Wolf ate idle scions on the plaza. Truce-ground means empty.
    assert(s.monsters.length === 0, `no monsters walk the Crossroads (${s.monsters.length})`);

    const pitches = s.sceneMetadata.wagonPitches || [];
    assert(pitches.length >= 8, 'the plaza ring offers wagon pitches');
    const homePitch = pitches.find(pitch => pitch.x === s.x && pitch.y === s.y - 1);
    assert(homePitch, `scion spawns beside their House wagon (at ${s.x},${s.y})`);

    // The morning market: first set-out of the day claims the road purse.
    await p.waitFor(() => p.messages.some(message => /road purse/i.test(message)), {
      timeoutMs: 6000,
      label: 'daily road-purse arrival message',
    });

    // Open the wagon through the real context menu.
    const menu = await p.rightClick(homePitch.x, homePitch.y);
    const wagonAction = menu.find(entry => entry.action?.actionId === 'player:screen:wagon');
    assert(wagonAction, 'the House wagon exposes a Wagon interaction');
    p.choose(wagonAction, { x: 0, y: 0, world: { x: homePitch.x, y: homePitch.y } });
    await p.waitFor(() => p.screens.some(screen => screen.screen === 'wagon'), {
      timeoutMs: 6000,
      label: 'wagon pane opens',
    });

    let wagon = p.screens.filter(screen => screen.screen === 'wagon').at(-1).payload;
    assert(wagon.house?.name, 'wagon pane names the House');
    assert(wagon.house.treasury >= 100, `road purse landed in the ledger (${wagon.house.treasury})`);
    const roadKit = wagon.stock.find(tier => tier.tier === 1);
    const ironTier = wagon.stock.find(tier => tier.tier === 2);
    assert(roadKit?.unlocked === true, 'road kit stock is always open');
    assert(ironTier?.unlocked === false, 'iron stock is gated behind prestige or the forge');

    // Nail carried gold under the boards.
    const treasuryBefore = wagon.house.treasury;
    p.emit('chronicles:house:deposit', { amount: 100 });
    wagon = await p.waitFor(() => {
      const latest = p.screens.filter(screen => screen.screen === 'wagon').at(-1).payload;
      return latest.house.treasury >= treasuryBefore + 100 ? latest : false;
    }, { timeoutMs: 6000, label: 'deposit reaches the House ledger' });

    // The House outfits its scion: treasury pays, backpack receives.
    const sword = roadKit.items.find(item => item.id === 'bronze-sword');
    assert(sword, 'road kit includes a bronze sword');
    const treasuryFunded = wagon.house.treasury;
    p.emit('wagon:outfit:buy', { itemId: 'bronze-sword' });
    await p.waitFor(async () => {
      const current = await p.state();
      return current.inventory.some(item => item.id === 'bronze-sword');
    }, { timeoutMs: 6000, label: 'outfitted bronze sword in backpack' });
    const afterBuy = await p.waitFor(() => {
      const latest = p.screens.filter(screen => screen.screen === 'wagon').at(-1).payload;
      return latest.house.treasury < treasuryFunded ? latest : false;
    }, { timeoutMs: 6000, label: 'the ledger paid for the outfitting' });
    assert(afterBuy.house.treasury === treasuryFunded - Math.max(1, sword.price),
      'outfitting debits exactly the stock price');
  } finally {
    p.close();
  }
}
