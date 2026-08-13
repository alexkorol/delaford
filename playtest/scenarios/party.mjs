/**
 * Two-player party lifecycle over the real login and WebSocket protocol.
 * Distinct guest identities are enabled only by the isolated playtest server.
 */
export default async function party({ connect, assert }) {
  const leader = await connect({
    loginPayload: {
      useGuestAccount: true,
      playtestGuestId: 'party-leader',
      playtestGuestName: 'Aster',
    },
  });
  const member = await connect({
    loginPayload: {
      useGuestAccount: true,
      playtestGuestId: 'party-member',
      playtestGuestName: 'Bram',
    },
  });

  try {
    assert(leader.player.uuid !== member.player.uuid, 'playtest guests have distinct server identities');

    leader.emit('party:create', {});
    await leader.waitFor(() => leader.party && leader.party.members.length === 1, {
      label: 'leader creates a party',
    });
    assert(leader.party.leaderId === leader.player.uuid, 'party creator is the leader');

    leader.emit('party:invite', { username: member.player.username });
    const invite = await member.waitFor(() => member.partyInvites.at(-1), {
      label: 'member receives the party invitation',
    });
    assert(invite.invitedBy === leader.player.username, 'invitation names its real sender');

    member.emit('party:invite:accept', { partyId: invite.partyId });
    await Promise.all([
      leader.waitFor(() => leader.party && leader.party.members.length === 2, {
        label: 'leader sees the accepted member',
      }),
      member.waitFor(() => member.party && member.party.members.length === 2, {
        label: 'member joins the shared party',
      }),
    ]);
    assert(leader.party.id === member.party.id, 'both clients share one authoritative party');

    leader.emit('party:ready', {});
    member.emit('party:ready', {});
    await Promise.all([
      leader.waitFor(() => leader.party && leader.party.members.every(entry => entry.ready), {
        label: 'leader sees every member ready',
      }),
      member.waitFor(() => member.party && member.party.members.every(entry => entry.ready), {
        label: 'member sees every member ready',
      }),
    ]);
    assert(true, 'readiness synchronises to the whole party');

    const leaderTransitions = leader.sceneTransitions || 0;
    const memberTransitions = member.sceneTransitions || 0;
    leader.emit('party:startInstance', {});
    await Promise.all([
      leader.waitFor(() => (leader.sceneTransitions || 0) > leaderTransitions, {
        timeoutMs: 12000,
        label: 'leader enters the party instance',
      }),
      member.waitFor(() => (member.sceneTransitions || 0) > memberTransitions, {
        timeoutMs: 12000,
        label: 'member enters the party instance',
      }),
    ]);

    const [leaderState, memberState] = await Promise.all([leader.state(), member.state()]);
    assert(leaderState.sceneId === memberState.sceneId, 'both members enter the same instance scene');
    assert(leaderState.sceneType === 'instance', 'the shared party scene is an instance');
    assert(leader.party.state === 'instance' && member.party.state === 'instance', 'instance state reaches both clients');

    const memberTownTransitions = member.sceneTransitions || 0;
    member.emit('party:leave', {});
    await Promise.all([
      member.waitFor(() => (
        (member.sceneTransitions || 0) > memberTownTransitions && member.party === null
      ), { label: 'departing member returns to town' }),
      leader.waitFor(() => leader.party && leader.party.members.length === 1, {
        label: 'leader sees departure cleanup',
      }),
    ]);
    const memberTown = await member.state();
    assert(memberTown.sceneType === 'town', 'leaving an instance returns the member to town');
    assert(leader.party.state === 'instance', 'the remaining leader keeps the live instance');

    const leaderTownTransitions = leader.sceneTransitions || 0;
    leader.emit('party:returnToTown', {});
    await leader.waitFor(() => (
      (leader.sceneTransitions || 0) > leaderTownTransitions
      && leader.party
      && leader.party.state === 'lobby'
    ), { label: 'leader returns the remaining party to town' });
    const leaderTown = await leader.state();
    assert(leaderTown.sceneType === 'town', 'party return restores the leader to town');
  } finally {
    member.close();
    leader.close();
  }
}
