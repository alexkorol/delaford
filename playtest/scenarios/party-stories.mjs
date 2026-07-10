/** Two independent friends party, witness final death, then recover its relic. */
export default async function partyStories({ connect, assert }) {
  const leader = await connect({
    guestId: 'party-story-leader', houseName: 'House Lantern', scionName: 'Mara',
  });
  const friend = await connect({
    guestId: 'party-story-friend', houseName: 'House Weir', scionName: 'Orun',
  });
  try {
    leader.createParty();
    await leader.waitFor(() => leader.party, { label: 'leader party creation' });
    leader.invitePlayer(friend.player.username);
    const invite = await friend.waitFor(() => friend.partyInvites[0], { label: 'friend party invite' });
    friend.acceptPartyInvite(invite.partyId);
    await leader.waitFor(() => leader.party?.members?.length === 2, { label: 'two-member party' });
    assert(leader.party.members.some(member => member.username === friend.player.username), 'friend joined the shared party');

    leader.togglePartyReady();
    friend.togglePartyReady();
    await leader.waitFor(() => leader.party?.members?.every(member => member.ready), { label: 'party ready' });
    const leaderTransitions = leader.sceneTransitions || 0;
    const friendTransitions = friend.sceneTransitions || 0;
    leader.startPartyInstance();
    await leader.waitFor(() => (leader.sceneTransitions || 0) > leaderTransitions, { label: 'leader instance entry' });
    await friend.waitFor(() => (friend.sceneTransitions || 0) > friendTransitions, { label: 'friend instance entry' });
    assert(leader.scene?.id === friend.scene?.id, 'both friends entered the same crypt instance');

    friend.devGive('gold-ring');
    const scene = await friend.state();
    const executioner = scene.monsters.find(monster => monster.rarity !== 'elite');
    friend.devPrepareFinalDeath();
    friend.devTeleport(Math.round(executioner.x) + 1, Math.round(executioner.y));
    const witnessed = await leader.waitFor(() => leader.scionFalls[0], {
      timeoutMs: 15000, label: 'friend permadeath witnessed',
    });
    assert(witnessed.fallen.name === friend.player.username, `leader witnessed ${friend.player.username}'s final fall`);
    assert(witnessed.relicCount >= 1, 'the witnessed fall returned a relic to the world');
  } finally {
    friend.close();
    leader.close();
  }

  await new Promise(resolve => { setTimeout(resolve, 500); });
  const runOne = await connect({ guestId: 'party-story-leader' });
  runOne.close();
  await new Promise(resolve => { setTimeout(resolve, 350); });
  const runTwo = await connect({ guestId: 'party-story-leader' });
  runTwo.close();
  await new Promise(resolve => { setTimeout(resolve, 350); });
  const heir = await connect({ guestId: 'party-story-leader' });
  try {
    await heir.enterZone('crypt', 'warren');
    heir.devReleaseRelic();
    const relic = await heir.waitFor(async () => {
      const state = await heir.state();
      return state.groundItems.find(item => item.legacy?.sourceScionName === 'Orun') || false;
    }, { timeoutMs: 6000, label: 'dead friend relic drop' });
    assert(relic.id === 'gold-ring', 'the survivor found the dead friend ring three runs later');
    heir.devTeleport(relic.x, relic.y + 1);
    await heir.takeItem(relic);
  } finally {
    heir.close();
  }
}
