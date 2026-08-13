/**
 * Mine both generated village quarry nodes through the real server-built
 * context menu, queued movement action, delayed gather, and respawn loop.
 */
export default async function mining({ connect, assert }) {
  const p = await connect();
  const plainLabel = entry => String(entry?.label || '').replace(/<[^>]+>/g, '').trim();
  const mineEntry = (menu, objectId) => menu.find(entry => (
    entry?.action?.actionId === 'player:resource:mining:rock'
    && entry.id === objectId
  ));
  const initial = await p.state();
  const knownUuids = new Set(initial.inventoryDetails.map(item => item.uuid));
  const cleanupItems = [];

  try {
    let pickaxe = initial.inventoryDetails.find(item => item.id.includes('pickaxe'));
    if (!pickaxe) {
      p.devGive('bronze-pickaxe', 1);
      pickaxe = await p.waitFor(async () => {
        const state = await p.state();
        return state.inventoryDetails.find(item => (
          item.id === 'bronze-pickaxe' && !knownUuids.has(item.uuid)
        ));
      }, { label: 'mining pickaxe enters the backpack' });
      cleanupItems.push(pickaxe);
    }

    const startingExperience = initial.skills?.mining?.exp || 0;
    const nodes = [
      { id: 280, x: 61, y: 129, standX: 60, resourceId: 'copper-ore', name: 'Copper Rocks' },
      { id: 281, x: 63, y: 129, standX: 62, resourceId: 'tin-ore', name: 'Tin Rocks' },
    ];

    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      p.devTeleport(node.standX, node.y);
      await p.waitFor(async () => {
        const state = await p.state();
        return state.x === node.standX && state.y === node.y;
      }, { label: `arrival beside ${node.name}` });

      const menu = await p.rightClick(node.x, node.y);
      const mine = mineEntry(menu, node.id);
      assert(mine,
        `${node.name} exposes its real Mine action (${menu.map(plainLabel).join(' | ')})`);
      p.choose(mine, { x: 0, y: 0, world: { x: node.x, y: node.y } });

      const mined = await p.waitFor(async () => {
        const state = await p.state();
        const ore = state.inventoryDetails.find(item => (
          item.id === node.resourceId && !knownUuids.has(item.uuid)
        ));
        const expectedExperience = startingExperience + ((index + 1) * 16);
        return ore && state.skills?.mining?.exp === expectedExperience
          ? { state, ore }
          : false;
      }, { timeoutMs: 12000, label: `${node.resourceId} and mining experience are awarded` });
      knownUuids.add(mined.ore.uuid);
      cleanupItems.push(mined.ore);

      const depletedMenu = await p.rightClick(node.x, node.y);
      assert(mineEntry(depletedMenu, 279),
        `${node.name} becomes the authoritative depleted-rock interaction`);
      assert(p.messages.some(message => message.includes(`successfully mined some ${node.name}`)),
        `${node.name} mining reports success to the player`);
    }

    for (const node of nodes) {
      await p.waitFor(async () => {
        const menu = await p.rightClick(node.x, node.y);
        return mineEntry(menu, node.id);
      }, {
        timeoutMs: 9000,
        intervalMs: 300,
        label: `${node.name} restores its interaction identity after respawn`,
      });
      assert(true, `${node.name} visibly respawns through the shared resource clock`);
    }
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
