/**
 * First explicit goal: accept Aldwyn's request in town, clear floor one of
 * The Old Barrow, then return for a permanent Verdigris-tree point.
 */
export default async function firstGoal({ connect, assert }) {
  const p = await connect({
    guestId: 'playtest-first-goal',
    houseName: 'House Firstlight',
    scionName: 'Quest Testborn',
  });

  try {
    const town = await p.state();
    const aldwyn = town.npcs.find(npc => npc.name === 'Aldwyn the Guide');
    assert(aldwyn, 'Aldwyn is present in the authoritative town scene');
    const approachX = aldwyn.x + 1;
    p.devTeleport(approachX, aldwyn.y);
    await p.waitFor(async () => (await p.state()).x === approachX, { label: 'Aldwyn approach' });

    const menu = await p.rightClick(aldwyn.x, aldwyn.y);
    const talk = menu.find(entry => entry.action?.actionId === 'player:npc:talk');
    assert(talk, 'Aldwyn exposes a Talk interaction in town');

    const messagesBefore = p.messages.length;
    p.choose(talk, { x: 0, y: 0, world: { x: aldwyn.x, y: aldwyn.y } });
    await p.waitFor(() => p.messages.slice(messagesBefore).some(message => (
      /old barrow/i.test(message) && /floor 1|first floor/i.test(message)
    )), { label: 'Aldwyn names the destination and floor' });
    assert(true, 'the accepted goal explicitly names The Old Barrow floor 1');

    let state = await p.state();
    const earnedBefore = state.passiveTree.earned;
    assert(state.quests?.firstGoal?.stage === 'clear-floor', 'server records the active floor-clear objective');

    await p.enterZone('dungeon', 'warren');
    p.devClearFloor();
    await p.waitFor(() => p.messages.some(message => /return to aldwyn/i.test(message)), {
      timeoutMs: 15000,
      label: 'return objective after floor clear',
    });
    assert(true, 'clearing floor 1 pushes an explicit return-to-Aldwyn objective');

    p.emit('party:returnToTown', {});
    await p.waitFor(async () => {
      const current = await p.state();
      return current.sceneType === 'town' && current.quests?.firstGoal?.stage === 'complete'
        ? current
        : false;
    }, { timeoutMs: 15000, label: 'goal completion after returning to town' });

    state = await p.state();
    assert(state.questPoints === 1, 'the first goal awards exactly one quest point');
    assert(state.passiveTree.earned === earnedBefore + 1, 'the reward increases authoritative tree capacity by one');
    assert(p.messages.some(message => /verdigris point/i.test(message)), 'Aldwyn explains the permanent reward');
  } finally {
    p.close();
  }
}
