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
  const relicIdentity = item => JSON.stringify({
    uuid: item.uuid,
    name: item.name,
    displayName: item.displayName,
    affixes: item.affixes,
    vessel: item.vessel,
    stats: item.stats,
  });
  let heirloomIdentity;
  let heirloomUuid;
  let accountUuid;
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
    accountUuid = mortal.uuid;
    assert(mortal.lifecycleMode === 'hard', 'mortal oath selects hard lifecycle mode');
    assert(mortal.chronicles && mortal.chronicles.scionId === fallenScionId,
      'server binds the selected Scion identity');

    p.devGive('bronze-sword', 1);
    const generatedHeirloom = await p.waitFor(async () => {
      const s = await p.state();
      return s.inventoryDetails.find(item => item.id === 'bronze-sword') || false;
    }, { label: 'mortal Scion heirloom generated' });
    p.equipItem(generatedHeirloom, 'right_hand');
    const equippedMortal = await p.waitFor(async () => {
      const s = await p.state();
      return s.wearDetails.right_hand?.uuid === generatedHeirloom.uuid ? s : false;
    }, { label: 'mortal Scion heirloom equipped' });
    heirloomUuid = generatedHeirloom.uuid;
    heirloomIdentity = relicIdentity(equippedMortal.wearDetails.right_hand);
    assert(equippedMortal.wearDetails.right_hand.vessel,
      'fallen heirloom starts with generated vessel identity');

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
    assert(relicIdentity(reconnected.wearDetails.right_hand) === heirloomIdentity,
      'fallen Scion still owns the exact heirloom before entombment');

    const ready = await p.returnToChronicles({ houseId, scionId: fallenScionId });
    assert(ready.fallen && ready.fallen.scionId === fallenScionId,
      'fallen Scion returns to the authenticated Chronicles');
    assert(ready.chronicles.houses[0].crypt.some(scion => scion.id === fallenScionId),
      'server Chronicle entombs the fallen Scion');
    assert(!ready.chronicles.houses[0].scions.some(scion => scion.id === fallenScionId),
      'server Chronicle cannot reselect the fallen Scion');
    const fallen = ready.chronicles.houses[0].crypt.find(scion => scion.id === fallenScionId);
    assert(fallen.relic && fallen.relic.status === 'queued',
      'equipped heirloom enters the crypt recovery queue');
    const cryptIdentity = relicIdentity(fallen.relic.item);
    assert(cryptIdentity === heirloomIdentity,
      'crypt preserves the heirloom UUID, rolls, and vessel exactly');
    assert(fallen.relic.item.boundTo === accountUuid,
      'crypt binds the heirloom to its authenticated House account');

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
    assert(successor.wearDetails.right_hand === null,
      'successor cannot inherit a duplicate of the queued heirloom');

    // Relics circulate through play, not a dev grant: the next elite slain by
    // a living successor returns one queued House heirloom to the ground.
    p.devGive('iron-sword', 1);
    const successorWeapon = await p.waitFor(async () => {
      const s = await p.state();
      return s.inventoryDetails.find(item => item.id === 'iron-sword') || false;
    }, { label: 'successor weapon granted' });
    p.equipItem(successorWeapon, 'right_hand');
    await p.waitFor(async () => (
      (await p.state()).wearDetails.right_hand?.uuid === successorWeapon.uuid
    ), { label: 'successor weapon equipped' });

    await p.enterZone('crypt', 'gauntlet');
    p.devSetLevel(100);
    p.devHeal();
    const instance = await p.state();
    const boss = instance.monsters.find(monster => monster.rarity === 'elite');
    assert(boss, 'successor finds an elite guarding the heirloom path');
    p.devTeleport(boss.x + 1, boss.y);
    await p.attack(boss);

    await p.waitFor(async () => {
      const s = await p.state();
      const livingBoss = s.monsters.find(monster => monster.uuid === boss.uuid);
      if (!livingBoss) {
        return s;
      }
      if (Math.abs(livingBoss.x - s.x) > 1 || Math.abs(livingBoss.y - s.y) > 1) {
        p.devTeleport(livingBoss.x + 1, livingBoss.y);
      }
      await p.attack(livingBoss);
      return false;
    }, { timeoutMs: 30000, intervalMs: 350, label: 'successor elite kill' });

    const circulated = await p.waitFor(async () => {
      const s = await p.state();
      const ground = s.groundItems.find(item => item.uuid === heirloomUuid);
      return ground ? { s, ground } : false;
    }, { label: 'fallen heirloom circulating as an elite drop' });
    assert(circulated.ground.chroniclesRelic?.scionId === fallenScionId,
      'world drop retains its fallen Scion provenance');

    p.devTeleport(circulated.ground.x, circulated.ground.y);
    await p.waitFor(async () => {
      const s = await p.state();
      return s.x === circulated.ground.x && s.y === circulated.ground.y;
    }, { label: 'successor reaches the fallen heirloom' });
    await p.takeItem(circulated.ground);
    const recovered = await p.waitFor(async () => {
      const s = await p.state();
      const inventoryRelic = s.inventoryDetails.find(item => item.uuid === heirloomUuid);
      const cryptScion = s.chroniclesRecord.state.houses[0].crypt
        .find(scion => scion.id === fallenScionId);
      return inventoryRelic && cryptScion.relic.status === 'recovered'
        ? { inventoryRelic, cryptScion }
        : false;
    }, { label: 'heirloom recovery persisted' });
    assert(relicIdentity(recovered.inventoryRelic) === heirloomIdentity,
      'recovered heirloom is the exact item the fallen Scion carried');
    assert(recovered.inventoryRelic.boundTo === accountUuid,
      'recovered heirloom remains bound to its House account');
    assert(recovered.cryptScion.relic.recoveredAt,
      'Chronicle records when the successor recovered the heirloom');
  } finally {
    p.close();
  }
}
