/**
 * Inventory overflow: generated rewards must remain owned and recoverable
 * when the spatial backpack cannot fit them all.
 */
export default async function overflow({ connect, assert }) {
  const p = await connect();
  try {
    const before = await p.state();
    const known = new Set([
      ...before.inventoryDetails,
      ...before.groundItems,
    ].filter(item => item.id === 'bronze-sword').map(item => item.uuid));

    p.devGive('bronze-sword', 50);

    const state = await p.waitFor(async () => {
      const next = await p.state();
      const inventory = next.inventoryDetails.filter(item => (
        item.id === 'bronze-sword' && !known.has(item.uuid)
      ));
      const ground = next.groundItems.filter(item => (
        item.id === 'bronze-sword' && !known.has(item.uuid)
      ));
      return inventory.length + ground.length === 50 && ground.length > 0
        ? { ...next, freshInventory: inventory, freshGround: ground }
        : false;
    }, { timeoutMs: 10000, label: 'all overflow grants remain recoverable' });

    assert(state.freshInventory.length > 0, 'backpack accepts every sword that fits');
    assert(state.freshGround.length > 0, 'overflow swords fall to the ground');
    assert(state.freshInventory.length + state.freshGround.length === 50,
      'no generated sword is lost');
    assert(state.freshInventory.every(item => item.boundTo === state.uuid),
      'inventory rewards bind to the real player after world admission');
    assert(state.freshGround.every(item => (
      item.boundTo === state.uuid && item.x === state.x && item.y === state.y
    )), 'overflow rewards stay bound at the player feet');

    const coinsBefore = state.inventory
      .filter(item => item.id === 'coins')
      .reduce((total, item) => total + item.qty, 0);
    const groundCoinsBefore = new Set(
      state.groundItems.filter(item => item.id === 'coins').map(item => item.uuid),
    );
    p.devGive('coins', 10);
    const stacked = await p.waitFor(async () => {
      const next = await p.state();
      const coins = next.inventory
        .filter(item => item.id === 'coins')
        .reduce((total, item) => total + item.qty, 0);
      return coins === coinsBefore + 10 ? next : false;
    }, { label: 'currency merges into a full backpack' });

    assert(stacked.groundItems
      .filter(item => item.id === 'coins')
      .every(item => groundCoinsBefore.has(item.uuid)),
    'fungible currency does not create an avoidable overflow drop');

    // Free the shared guest backpack through the same production drop action
    // the inventory UI uses. Later scenarios must never depend on test order.
    state.freshInventory.forEach((item) => {
      p.emit('player:inventory:commit', {
        id: state.uuid,
        player: { socket_id: p.player.socket_id },
        action: 'world-drop',
        item: { id: item.id, uuid: item.uuid, slot: item.slot },
      });
    });
    await p.waitFor(async () => {
      const next = await p.state();
      const freshUuids = new Set(state.freshInventory.map(item => item.uuid));
      return next.inventoryDetails.every(item => !freshUuids.has(item.uuid));
    }, { label: 'overflow scenario restores backpack capacity' });
  } finally {
    p.close();
  }
}
