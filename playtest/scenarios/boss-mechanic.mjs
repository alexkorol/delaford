/**
 * Old Barrow boss contract: its ground slam is announced before damage,
 * escaping the marked radius avoids it, and remaining inside takes the hit.
 */
export default async function bossMechanic({ connect, assert }) {
  const p = await connect({
    guestId: 'playtest-boss-mechanic',
    houseName: 'House Stonewake',
    scionName: 'Dodge Testborn',
  });

  try {
    await p.enterZone('dungeon', 'warren');
    let state = await p.state();
    const boss = state.monsters.find(monster => monster.rarity === 'elite');
    assert(boss?.name === 'Warden of the Deep', 'Old Barrow ends in its named boss');

    p.devSetLevel(5);
    p.devHeal();
    p.devTeleport(Math.round(boss.x) + 1, Math.round(boss.y));
    const firstTelegraph = await p.waitFor(() => p.telegraphs.find(event => (
      event.attackerId === boss.uuid && event.skillId === 'boss:ground-slam'
    )), { timeoutMs: 8000, label: 'Warden ground-slam warning' });

    assert(firstTelegraph.radius >= 2, 'the warning declares a meaningful danger radius');
    assert(firstTelegraph.durationMs >= 800, 'the warning leaves a readable dodge window');

    const hitsBeforeDodge = p.hits.length;
    p.devTeleport(
      Math.round(firstTelegraph.x + firstTelegraph.radius + 2),
      Math.round(firstTelegraph.y),
    );
    await new Promise(resolve => { setTimeout(resolve, firstTelegraph.durationMs + 300); });
    const dodgedHits = p.hits.slice(hitsBeforeDodge).filter(hit => (
      hit.attackerId === boss.uuid && hit.skillId === 'boss:ground-slam'
    ));
    assert(dodgedHits.length === 0, 'leaving the marked circle avoids the ground slam');

    state = await p.state();
    p.devHeal();
    p.devTeleport(Math.round(boss.x) + 1, Math.round(boss.y));
    const telegraphsBefore = p.telegraphs.length;
    const secondTelegraph = await p.waitFor(() => p.telegraphs.slice(telegraphsBefore).find(event => (
      event.attackerId === boss.uuid && event.skillId === 'boss:ground-slam'
    )), { timeoutMs: 8000, label: 'second Warden ground-slam warning' });
    const committedHit = await p.waitFor(() => p.hits.find(hit => (
      hit.attackerId === boss.uuid
      && hit.skillId === 'boss:ground-slam'
      && hit.amount > 0
    )), { timeoutMs: secondTelegraph.durationMs + 3000, label: 'ground slam impact' });
    assert(committedHit.amount > 0, 'remaining in the circle takes the named boss hit');
    assert((await p.state()).lifecycle === 'alive', 'the opening boss mechanic is survivable at its level band');
  } finally {
    p.close();
  }
}
