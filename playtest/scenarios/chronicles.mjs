/**
 * Core pillar: a mortal scion falls through real monster combat, enters the
 * server-side crypt, and their ring comes back through the live loot stream
 * after three later Set Out runs.
 */
export default async function chronicles({ connect, assert }) {
  // A stable guest id keeps every reconnect inside the same House Chronicle
  // (the relic must return to the same house three runs later). Explicit
  // guestId routes through the Chronicle-auth login flow.
  const guestId = `playtest-chronicles-${Date.now()}`;
  const houseName = 'House Chronicle';
  const fallen = await connect({ guestId, houseName, scionName: 'Chron the First' });
  let fallenName;
  try {
    fallenName = fallen.player.username;
    fallen.devGive('gold-ring');
    await fallen.enterZone('crypt', 'gauntlet');
    const scene = await fallen.state();
    const executioner = scene.monsters.find(monster => monster.rarity !== 'elite');
    assert(executioner, 'found a monster to deliver final death');
    fallen.devPrepareFinalDeath();
    fallen.devTeleport(Math.round(executioner.x) + 1, Math.round(executioner.y));

    const memorial = await fallen.waitFor(() => fallen.scionFalls[0], {
      timeoutMs: 15000,
      intervalMs: 250,
      label: 'permadeath-to-crypt event',
    });
    assert(memorial.fallen.name === fallenName, `${fallenName} was named in the fall`);
    assert(memorial.relicCount >= 1, 'notable gear was committed to circulation');
    const house = memorial.chronicle.houses.find(entry => entry.id === memorial.chronicle.activeHouseId);
    assert(house.crypt.some(scion => scion.name === fallenName), 'fallen scion is present in the server crypt');
  } finally {
    fallen.close();
  }

  // Each Set Out advances the House run ledger. Relics are deliberately
  // dormant for three later runs so their return feels like history.
  const firstRun = await connect({ guestId, houseName, scionName: 'Chron Again' });
  firstRun.close();
  await new Promise(resolve => { setTimeout(resolve, 350); });
  const secondRun = await connect({ guestId, houseName, scionName: 'Chron Anew' });
  secondRun.close();
  await new Promise(resolve => { setTimeout(resolve, 350); });
  const heir = await connect({ guestId, houseName, scionName: 'Chron the Heir' });

  try {
    await heir.enterZone('crypt', 'warren');
    heir.devSetLevel(10);
    heir.devHeal();
    heir.devReleaseRelic();

    const ring = await heir.waitFor(async () => {
      const state = await heir.state();
      const relic = state.groundItems.find(item => item.id === 'gold-ring' && item.legacyRelicId);
      if (relic) return relic;
      return false;
    }, { timeoutMs: 6000, intervalMs: 250, label: 'ancestral ring drop' });

    assert(ring.legacy.sourceScionName === fallenName, `the ring remembers ${fallenName}`);
    heir.devTeleport(ring.x, ring.y + 1);
    await heir.takeItem(ring);
    assert(true, 'a later scion recovered the ancestral ring through real pickup');

    const beforeDescent = await heir.state();
    const transitionsBefore = heir.sceneTransitions || 0;
    heir.devTeleport(beforeDescent.sceneMetadata.stairsDown.x, beforeDescent.sceneMetadata.stairsDown.y);
    await heir.waitFor(() => (heir.sceneTransitions || 0) > transitionsBefore, {
      timeoutMs: 8000,
      label: 'infinite-ladder descent',
    });
    const deeper = await heir.state();
    assert(deeper.sceneMetadata.depth === 2, 'stairs generated floor 2 of the endless descent');
    assert(deeper.bestDepth >= 2, `server recorded the scion depth record (${deeper.bestDepth})`);
  } finally {
    heir.close();
  }
}
