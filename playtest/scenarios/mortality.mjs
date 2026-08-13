/**
 * Core loop: MORTALITY. A mortal Scion uses hard lifecycle rules, final death
 * returns the authenticated socket to Chronicles, and a new Scion can enter
 * the town alive without resurrecting the fallen identity.
 */
export default async function mortality({ connect, assert }) {
  let p = await connect({
    loginPayload: { useGuestAccount: true, awaitChronicles: true },
  });

  const houseId = 'house-playtest';
  const fallenScionId = 'scion-mortal';
  try {
    assert(p.player === null, 'Chronicles admission holds the account outside the world');

    const foundedAt = new Date().toISOString();
    const initialChronicle = {
      version: 3,
      houses: [{
        id: houseId,
        name: 'Playtest',
        renown: 0,
        foundedAt,
        scions: [{
          id: fallenScionId,
          name: 'Morrow',
          level: 1,
          bornAt: foundedAt,
          diedAt: null,
          deeds: [],
          mortal: true,
        }, {
          id: 'scion-successor',
          name: 'Sable',
          level: 1,
          bornAt: foundedAt,
          diedAt: null,
          deeds: [],
          mortal: false,
        }],
        crypt: [],
      }],
      activeHouseId: houseId,
      activeScionId: fallenScionId,
    };
    const seeded = await p.saveChronicles(initialChronicle);
    assert(seeded.chroniclesRevision === 1, 'server owns the seeded Chronicle revision');

    await p.selectScion({
      houseId,
      scionId: fallenScionId,
      scionName: 'Morrow',
      mortal: true,
    });
    const mortal = await p.state();
    assert(mortal.lifecycleMode === 'hard', 'mortal oath selects hard lifecycle mode');
    assert(mortal.chronicles && mortal.chronicles.scionId === fallenScionId,
      'server binds the selected Scion identity');

    p.devKill();
    await p.waitFor(() => (
      p.stats && p.stats.lifecycle && p.stats.lifecycle.state === 'permadead'
    ), { label: 'mortal final death' });

    // Simulate losing the client before it can acknowledge the death. The
    // immediate hard-death save must prevent a reconnect from reviving this
    // same identity.
    p.close();
    await new Promise(resolve => { setTimeout(resolve, 500); });
    p = await connect({
      loginPayload: {
        useGuestAccount: true,
        awaitChronicles: true,
        houseId,
        scionId: fallenScionId,
        scionName: 'Morrow',
        mortal: true,
      },
    });
    const reconnected = await p.state();
    assert(reconnected.lifecycle === 'permadead', 'reconnect does not resurrect a fallen mortal Scion');

    const ready = await p.returnToChronicles({ houseId, scionId: fallenScionId });
    assert(ready.fallen && ready.fallen.scionId === fallenScionId,
      'fallen Scion returns to the authenticated Chronicles');
    assert(ready.chronicles.houses[0].crypt.some(scion => scion.id === fallenScionId),
      'server Chronicle entombs the fallen Scion');
    assert(!ready.chronicles.houses[0].scions.some(scion => scion.id === fallenScionId),
      'server Chronicle cannot reselect the fallen Scion');

    await p.selectScion({
      houseId,
      scionId: 'scion-successor',
      scionName: 'Sable',
      mortal: false,
    });
    const successor = await p.state();
    assert(successor.lifecycle === 'alive', 'successor enters alive');
    assert(successor.lifecycleMode === 'soft', 'successor keeps the default soft lifecycle');
    assert(successor.sceneType === 'town', `successor starts in town (${successor.sceneName})`);
  } finally {
    p.close();
  }
}
