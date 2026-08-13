/**
 * Town economy: both services must be discovered through a real moving NPC,
 * then mutate inventory through the same pane context menus as the browser.
 */
export default async function economy({ connect, assert }) {
  const p = await connect();
  const plainLabel = entry => String(entry?.label || '').replace(/<[^>]+>/g, '').trim();
  const actionNamed = (menu, name) => menu.find(entry => (
    String(entry?.action?.name || '').toLowerCase() === name.toLowerCase()
    || plainLabel(entry).toLowerCase().startsWith(name.toLowerCase())
  ));
  const itemQuantity = (items, id) => items
    .filter(item => item.id === id)
    .reduce((total, item) => total + (item.qty || 1), 0);

  const openNpcPane = async (action, screen) => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const state = await p.state();
      const npc = state.npcs.find(entry => entry.actions.includes(action.toLowerCase()));
      assert(npc, `town exposes a live ${action} NPC`);

      p.devTeleport(npc.tileX, npc.tileY);
      await p.waitFor(async () => {
        const arrived = await p.state();
        return arrived.x === npc.tileX && arrived.y === npc.tileY;
      }, { label: `arrival beside ${npc.name}` });

      const menu = await p.rightClick(npc.tileX, npc.tileY);
      const entry = actionNamed(menu, action);
      if (!entry) {
        continue;
      }

      const opensBefore = p.screenOpenCount;
      p.choose(entry, { x: 0, y: 0, world: { x: npc.tileX, y: npc.tileY } });
      const opened = await p.waitFor(() => (
        p.screenOpenCount > opensBefore && p.currentScreen === screen
      ), { timeoutMs: 6000, label: `${screen} pane opens from ${npc.name}` })
        .then(() => true)
        .catch(() => false);
      if (opened) {
        assert(true, `${action} is reachable through the real NPC context menu`);
        return;
      }
    }

    throw new Error(`Could not open ${screen} through its moving NPC`);
  };

  try {
    const initial = await p.state();
    const startingCoins = itemQuantity(initial.inventory, 'coins');
    assert(startingCoins >= 5, 'the player has enough coins for a general-store purchase');

    await openNpcPane('Trade', 'shop');
    const knifeStock = p.currentScreenPayload?.inventory?.find(item => item.id === 'knife');
    assert(knifeStock, 'the General Store stocks knives');

    const knownKnives = new Set(initial.inventoryDetails
      .filter(item => item.id === 'knife')
      .map(item => item.uuid));
    const buyMenu = await p.paneMenu('shopSlot', knifeStock.slot);
    const buyOne = actionNamed(buyMenu, 'Buy');
    assert(buyOne, 'shop inventory exposes Buy-1 through the real pane menu');
    const shopState = await p.state();
    p.choose(buyOne, { x: 0, y: 0, world: { x: shopState.x, y: shopState.y } });

    const purchased = await p.waitFor(async () => {
      const state = await p.state();
      const knife = state.inventoryDetails.find(item => (
        item.id === 'knife' && !knownKnives.has(item.uuid)
      ));
      return knife && itemQuantity(state.inventory, 'coins') === startingCoins - 5
        ? { state, knife }
        : false;
    }, { label: 'buying spends coins and adds the selected item' });
    assert(true, 'General Store purchase is authoritative');

    const sellMenu = await p.paneMenu('inventorySlot', purchased.knife.slot);
    const sellOne = actionNamed(sellMenu, 'Sell');
    assert(sellOne, 'backpack item exposes Sell-1 while the shop is open');
    p.choose(sellOne, {
      x: 0,
      y: 0,
      world: { x: purchased.state.x, y: purchased.state.y },
    });

    await p.waitFor(async () => {
      const state = await p.state();
      return state.inventoryDetails.every(item => item.uuid !== purchased.knife.uuid)
        && itemQuantity(state.inventory, 'coins') === startingCoins
        ? state
        : false;
    }, { label: 'selling removes the item and restores its coin value' });
    assert(true, 'General Store sale is authoritative');

    await openNpcPane('Bank', 'bank');
    const beforeDeposit = await p.state();
    const bankCoinsBefore = itemQuantity(beforeDeposit.bank, 'coins');
    const inventoryCoins = beforeDeposit.inventory.find(item => item.id === 'coins');
    assert(inventoryCoins, 'coins remain in the backpack for banking');

    const depositMenu = await p.paneMenu('inventorySlot', inventoryCoins.slot);
    const depositFive = depositMenu.find(entry => plainLabel(entry).toLowerCase().startsWith('deposit-5'));
    assert(depositFive, 'backpack coins expose Deposit-5 through the real bank menu');
    p.choose(depositFive, {
      x: 0,
      y: 0,
      world: { x: beforeDeposit.x, y: beforeDeposit.y },
    });

    const deposited = await p.waitFor(async () => {
      const state = await p.state();
      return itemQuantity(state.inventory, 'coins') === startingCoins - 5
        && itemQuantity(state.bank, 'coins') === bankCoinsBefore + 5
        ? state
        : false;
    }, { label: 'deposit moves coins from backpack to bank' });
    assert(true, 'bank deposit is authoritative');

    const bankCoins = deposited.bank.find(item => item.id === 'coins');
    const withdrawMenu = await p.paneMenu('bankSlot', bankCoins.slot);
    const withdrawFive = withdrawMenu.find(entry => plainLabel(entry).toLowerCase().startsWith('withdraw-5'));
    assert(withdrawFive, 'bank coins expose Withdraw-5 through the real bank menu');
    p.choose(withdrawFive, {
      x: 0,
      y: 0,
      world: { x: deposited.x, y: deposited.y },
    });

    await p.waitFor(async () => {
      const state = await p.state();
      return itemQuantity(state.inventory, 'coins') === startingCoins
        && itemQuantity(state.bank, 'coins') === bankCoinsBefore
        ? state
        : false;
    }, { label: 'withdraw restores the original backpack and bank balances' });
    assert(true, 'bank withdrawal is authoritative and the scenario leaves balances unchanged');
  } finally {
    p.close();
  }
}
