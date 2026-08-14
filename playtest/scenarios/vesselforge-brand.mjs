/** A town forge turns one visible inventory choice into a persistent item change. */
export default async function vesselforgeBrand({ connect, assert }) {
  const p = await connect({
    guestId: 'playtest-vesselforge-brand',
    houseName: 'House Smith',
    scionName: 'Tala Testborn',
  });
  try {
    p.devGive('bronze-pike', 1, { seed: 1, itemLevel: 20 });
    const before = await p.waitFor(async () => {
      const state = await p.state();
      const item = state.inventory.find(entry => entry.id === 'bronze-pike');
      return item?.vessel?.item ? { state, item } : false;
    }, { label: 'deterministic vessel item grant' });

    const brandsBefore = before.item.vessel.item.brands.length;
    const coinsBefore = before.state.inventory
      .filter(item => item.id === 'coins')
      .reduce((sum, item) => sum + item.qty, 0);
    const menu = await p.inventoryMenu(before.item);
    const addBrand = menu.find(entry => entry.action?.actionId === 'player:vesselforge:add-brand');
    assert(addBrand, 'a vessel item exposes the Delaford brand service');
    assert(/100 coins/i.test(addBrand.label), 'the menu states the exact crafting cost');

    p.choose(addBrand, { x: 0, y: 0 });
    const after = await p.waitFor(async () => {
      const state = await p.state();
      const item = state.inventory.find(entry => entry.uuid === before.item.uuid);
      return item?.vessel?.item?.brands?.length === brandsBefore + 1 ? { state, item } : false;
    }, { label: 'authoritative brand addition' });

    const coinsAfter = after.state.inventory
      .filter(item => item.id === 'coins')
      .reduce((sum, item) => sum + item.qty, 0);
    assert(coinsAfter === coinsBefore - 100, 'adding a brand spends exactly 100 coins');
    assert(after.item.vessel.lines.some(line => line.section === 'brand'), 'the refreshed tooltip contains the new brand');
  } finally {
    p.close();
  }
}
