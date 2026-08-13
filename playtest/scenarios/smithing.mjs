/**
 * The original furnace/anvil loop looked functional in pane-only tests while
 * live crafting could award XP on failure, hang on missing ore, and crash on
 * two recipes. Exercise both fixtures, both pane context menus, the queued
 * world action, inventory mutation, and skill XP over the real protocol.
 */
export default async function smithing({ connect, assert }) {
  const p = await connect();
  const plainLabel = entry => String(entry?.label || '').replace(/<[^>]+>/g, '').trim();
  const actionNamed = (menu, name) => menu.find(entry => (
    String(entry?.action?.name || '').toLowerCase() === name.toLowerCase()
    || plainLabel(entry).toLowerCase().startsWith(name.toLowerCase())
  ));
  const inventoryIds = state => new Set(state.inventoryDetails.map(item => item.uuid));
  let cleanupItems = [];

  try {
    const before = await p.state();
    const known = inventoryIds(before);
    const startingExperience = before.skills?.smithing?.exp || 0;

    p.devGive('tin-ore', 1);
    p.devGive('copper-ore', 1);
    p.devGive('hammer', 1);
    const supplied = await p.waitFor(async () => {
      const state = await p.state();
      const fresh = state.inventoryDetails.filter(item => !known.has(item.uuid));
      return ['tin-ore', 'copper-ore', 'hammer'].every(id => fresh.some(item => item.id === id))
        ? { state, fresh }
        : false;
    }, { label: 'smithing ingredients enter the backpack' });
    cleanupItems = supplied.fresh.filter(item => item.id === 'hammer');

    p.devTeleport(51, 121);
    await p.waitFor(async () => {
      const state = await p.state();
      return state.x === 51 && state.y === 121;
    }, { label: 'arrival beside the surface furnace' });

    const furnaceMenu = await p.rightClick(52, 121);
    const openFurnace = actionNamed(furnaceMenu, 'Smelt');
    assert(openFurnace,
      `surface furnace exposes its real Smelt action (${furnaceMenu.map(plainLabel).join(' | ')})`);
    const furnaceOpensBefore = p.screenOpenCount;
    p.choose(openFurnace, { x: 0, y: 0, world: { x: 52, y: 121 } });
    await p.waitFor(() => (
      p.screenOpenCount > furnaceOpensBefore && p.currentScreen === 'furnace'
    ), { label: 'furnace pane opens through queued movement' });

    const barMenu = await p.paneMenu('furnaceSlot', 0);
    const smeltBronze = actionNamed(barMenu, 'Smelt');
    assert(smeltBronze, 'bronze bar exposes its real pane Smelt action');
    const beforeSmelt = await p.state();
    const suppliedIds = new Set(supplied.fresh.map(item => item.uuid));
    p.choose(smeltBronze, { x: 0, y: 0, world: { x: beforeSmelt.x, y: beforeSmelt.y } });

    const smelted = await p.waitFor(async () => {
      const state = await p.state();
      const freshBar = state.inventoryDetails.find(item => (
        item.id === 'bronze-bar' && !known.has(item.uuid)
      ));
      const ingredientsGone = state.inventoryDetails.every(item => (
        !suppliedIds.has(item.uuid) || item.id === 'hammer'
      ));
      return freshBar && ingredientsGone && state.skills?.smithing?.exp === startingExperience + 7
        ? { state, freshBar }
        : false;
    }, { label: 'bronze smelt consumes ore and grants experience once' });

    p.devTeleport(54, 121);
    await p.waitFor(async () => {
      const state = await p.state();
      return state.x === 54 && state.y === 121;
    }, { label: 'arrival beside the surface anvil' });

    const anvilMenu = await p.rightClick(55, 121);
    const openAnvil = actionNamed(anvilMenu, 'Smith');
    assert(openAnvil,
      `surface anvil exposes its real Smith action (${anvilMenu.map(plainLabel).join(' | ')})`);
    const anvilOpensBefore = p.screenOpenCount;
    p.choose(openAnvil, { x: 0, y: 0, world: { x: 55, y: 121 } });
    await p.waitFor(() => (
      p.screenOpenCount > anvilOpensBefore && p.currentScreen === 'anvil'
    ), { label: 'anvil pane opens through queued movement' });

    const recipeMenu = await p.paneMenu('anvilSlot', 0);
    const forgeDagger = actionNamed(recipeMenu, 'Forge');
    assert(forgeDagger, 'bronze dagger exposes its real pane Forge action');
    const beforeForge = await p.state();
    p.choose(forgeDagger, { x: 0, y: 0, world: { x: beforeForge.x, y: beforeForge.y } });

    const forged = await p.waitFor(async () => {
      const state = await p.state();
      const dagger = state.inventoryDetails.find(item => (
        item.id === 'bronze-dagger' && !known.has(item.uuid)
      ));
      const barGone = state.inventoryDetails.every(item => item.uuid !== smelted.freshBar.uuid);
      return dagger && barGone && state.skills?.smithing?.exp === startingExperience + 20
        ? { state, dagger }
        : false;
    }, { label: 'bronze forge consumes its bar and grants experience once' });
    cleanupItems.push(forged.dagger);

    assert(p.messages.some(message => /successfully smelted a Bronze Bar/i.test(message)),
      'smelting reports the crafted bar to the player');
    assert(p.messages.some(message => /successfully smithed a Bronze Dagger/i.test(message)),
      'forging reports the crafted weapon to the player');
  } finally {
    cleanupItems.forEach((item) => {
      p.emit('player:inventory:commit', {
        action: 'world-drop',
        item: { id: item.id, uuid: item.uuid, slot: item.slot },
      });
    });
    p.close();
  }
}
