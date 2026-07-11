/**
 * Town loop: clean starter kit, restorative fountain, automatic gold, and
 * visible shop-floor stock that opens the existing authoritative trader.
 */
export default async function townAmenities({ connect, assert }) {
  const p = await connect({
    guestId: 'playtest-town-amenities',
    houseName: 'House Crossroads',
    scionName: 'Mara Testborn',
  });
  try {
    let state = await p.state();
    assert(state.sceneType === 'town', 'new scion begins in Delaford town');
    assert(!state.inventory.some(item => item.id === 'hammer'), 'starter backpack omits the smithing hammer');
    assert(!state.inventory.some(item => item.id === 'bronze-bar'), 'starter backpack omits bronze ingots');
    assert(state.inventory.some(item => item.id === 'coins' && item.qty >= 100), 'starter gold remains available');

    p.devHurt(5);
    const hurt = await p.waitFor(async () => {
      const current = await p.state();
      return current.hp.current < current.hp.max ? current : false;
    }, { label: 'nonlethal fountain test damage' });
    p.devTeleport(39, 115);
    await p.waitFor(async () => (await p.state()).x === 39, { label: 'fountain approach' });
    const fountainMenu = await p.rightClick(38, 115);
    const drink = fountainMenu.find(entry => entry.action?.actionId === 'player:fountain:drink');
    assert(drink, 'Crossroads fountain exposes a Drink interaction');
    p.emit('player:fountain:drink', {});
    await p.waitFor(async () => {
      const current = await p.state();
      return current.hp.current === current.hp.max;
    }, { label: `fountain healing above ${hurt.hp.current} HP` });
    assert(true, 'drinking restores the scion to full health');

    state = await p.state();
    const coinsBefore = state.inventory
      .filter(item => item.id === 'coins')
      .reduce((sum, item) => sum + item.qty, 0);
    p.devDrop('coins');
    await p.waitFor(async () => (await p.state()).groundItems.some(item => item.id === 'coins'), {
      label: 'gold placed on the ground',
    });
    await p.move('right', 1);
    await p.waitFor(async () => {
      const current = await p.state();
      const total = current.inventory
        .filter(item => item.id === 'coins')
        .reduce((sum, item) => sum + item.qty, 0);
      return total > coinsBefore && !current.groundItems.some(item => item.id === 'coins');
    }, { label: 'automatic gold pickup' });
    assert(true, 'nearby gold enters the backpack without a Take action');

    p.devTeleport(45, 102);
    await p.waitFor(async () => (await p.state()).y === 102, { label: 'General Store approach' });
    const displayMenu = await p.rightClick(45, 101);
    const browse = displayMenu.find(entry => entry.action?.actionId === 'player:screen:shop-display');
    const take = displayMenu.find(entry => entry.action?.actionId === 'player:take');
    assert(browse && browse.shopItemId === 'bronze-sword', 'floor stock opens the General Store');
    assert(!take, 'shop display stock cannot be taken for free');
    p.choose(browse, { x: 0, y: 0, world: { x: 45, y: 101 } });
    await p.waitFor(() => p.screens.some(screen => (
      screen.screen === 'shop' && screen.payload?.name === 'General Store'
    )), { label: 'General Store pane opening from floor stock' });
    assert(true, 'floor stock opens the live buy/sell pane');
  } finally {
    p.close();
  }
}
