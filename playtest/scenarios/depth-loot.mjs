/**
 * Endless-depth loot contract: the guaranteed treasure item on floor 5 must
 * visibly carry a substantially higher item level than floor 1.
 */
export default async function depthLoot({ connect, assert }) {
  const p = await connect({
    guestId: 'playtest-depth-loot',
    houseName: 'House Deepdelve',
    scionName: 'Hoard Testborn',
  });

  try {
    await p.enterZone('dungeon', 'warren');
    let state = await p.state();
    const shallow = state.groundItems.find(item => item.id !== 'coins' && item.itemLevel);
    assert(shallow, 'floor 1 contains a guaranteed item-level treasure');

    while (state.sceneMetadata.depth < 5) {
      const transitions = p.sceneTransitions || 0;
      p.devTeleport(state.sceneMetadata.stairsDown.x, state.sceneMetadata.stairsDown.y);
      await p.waitFor(() => (p.sceneTransitions || 0) > transitions, {
        timeoutMs: 8000,
        label: `descent beyond floor ${state.sceneMetadata.depth}`,
      });
      state = await p.state();
    }

    const deep = state.groundItems.find(item => item.id !== 'coins' && item.itemLevel);
    assert(deep, 'floor 5 contains a guaranteed item-level treasure');
    assert(deep.itemLevel >= shallow.itemLevel + 30,
      `floor 5 treasure visibly raises item level (${shallow.itemLevel} -> ${deep.itemLevel})`);
    assert(deep.vessel?.item?.ilvl === deep.itemLevel, 'displayed item level comes from the live vessel');
  } finally {
    p.close();
  }
}
