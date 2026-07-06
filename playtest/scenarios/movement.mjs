/**
 * Core loop: MOVE. WASD-equivalent steps in all four directions must actually
 * move the character, and entering a zone mid-walk must not bounce the player
 * back to town (regression: stale walk path onto the entry stairs).
 */
export default async function movement({ connect, assert }) {
  const p = await connect();
  try {
    const start = await p.state();

    await p.move('down', 3);
    const afterDown = await p.state();
    assert(afterDown.y > start.y, `moved down (${start.y} -> ${afterDown.y})`);

    await p.move('right', 3);
    const afterRight = await p.state();
    assert(afterRight.x > afterDown.x, `moved right (${afterDown.x} -> ${afterRight.x})`);

    await p.move('up', 2);
    await p.move('left', 2);
    const afterReturn = await p.state();
    assert(afterReturn.x < afterRight.x && afterReturn.y < afterRight.y, 'moved back up-left');

    // Regression: enter a zone WHILE steps are still in flight.
    p.step('right');
    p.step('right');
    await p.enterZone('dungeon', 'warren');
    await new Promise(resolve => { setTimeout(resolve, 2000); });
    const inZone = await p.state();
    assert(inZone.sceneType === 'instance', `still in the instance after 2s (scene: ${inZone.sceneName})`);
    assert(!p.messages.some(m => m.includes('returns to the surface')), 'no bounce back to town');

    // Movement still works inside the instance. The spawn tile hugs the
    // entry stairs, so some directions may be walls — any one moving is
    // proof of life.
    const before = await p.state();
    let movedInside = false;
     
    for (const direction of ['down', 'right', 'up', 'left']) {
      await p.move(direction, 2);
      const after = await p.state();
      if (before.x !== after.x || before.y !== after.y) {
        movedInside = true;
        break;
      }
    }
     
    assert(movedInside, 'moved inside the instance');
  } finally {
    p.close();
  }
}
