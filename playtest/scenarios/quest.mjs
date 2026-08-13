/**
 * Progression loop: complete the four authoritative commissions through
 * movement, combat, loot, equipment, a named boss, and floor descent; then
 * relog and verify points, House renown, and Scion deeds remain authoritative.
 */
export default async function quest({ connect, assert }) {
  let p = await connect({
    loginPayload: { useGuestAccount: true, awaitChronicles: true },
  });
  const houseId = 'house-quest-playtest';
  const scionId = 'scion-quest-playtest';

  try {
    let chronicle = p.chroniclesReady;
    if (!chronicle.chroniclesExists) {
      const createdAt = new Date().toISOString();
      chronicle = await p.saveChronicles({
        version: 3,
        houses: [{
          id: houseId,
          name: 'Wayfarer',
          renown: 0,
          foundedAt: createdAt,
          scions: [{
            id: scionId,
            name: 'Aster',
            level: 1,
            bornAt: createdAt,
            diedAt: null,
            deeds: [],
            mortal: false,
          }],
          crypt: [],
        }],
        activeHouseId: houseId,
        activeScionId: scionId,
      });
    }

    const house = chronicle.chronicles.houses.find(entry => entry.scions.length) || null;
    const living = house && house.scions[0];
    assert(house && living, 'a living Scion is available for the commission');
    await p.selectScion({
      houseId: house.id,
      scionId: living.id,
      scionName: living.name,
      mortal: living.mortal,
    });

    let state = await p.state();
    assert(state.quests && state.quests.activeQuestId === 'aldwyns-charge',
      "Aldwyn's Charge starts authoritatively on world admission");

    if (state.quests.objectiveIndex === 0) {
      await p.move('down', 1);
      state = await p.waitFor(async () => {
        const next = await p.state();
        return next.quests.objectiveIndex >= 1 ? next : false;
      }, { label: 'quest movement objective' });
    }
    assert(state.quests.objectiveIndex >= 1, 'walking completes the first quest objective');

    // Entering early is deliberately ignored by the ordered quest. It gives
    // us a populated combat scene without bypassing the final delve step.
    if (state.sceneType !== 'instance') {
      await p.enterZone('grove', 'clearings');
    }
    p.devSetLevel(10);
    p.devHeal();
    const combatScene = await p.state();
    const groundBefore = new Set(combatScene.groundItems.map(item => item.uuid));
    const target = combatScene.monsters
      .filter(monster => monster.rarity !== 'elite')
      .sort((a, b) => (Math.abs(a.x - combatScene.x) + Math.abs(a.y - combatScene.y))
        - (Math.abs(b.x - combatScene.x) + Math.abs(b.y - combatScene.y)))[0];
    assert(target, 'the commission finds a hostile creature');
    p.devTeleport(target.x + 1, target.y);
    await p.attack(target);

    state = await p.waitFor(async () => {
      const next = await p.state();
      const livingTarget = next.monsters.find(monster => monster.uuid === target.uuid);
      if (!livingTarget && next.quests.objectiveIndex >= 3) {
        return next;
      }
      if (livingTarget) {
        if (Math.abs(livingTarget.x - next.x) > 1 || Math.abs(livingTarget.y - next.y) > 1) {
          p.devTeleport(livingTarget.x + 1, livingTarget.y);
        }
        await p.attack(livingTarget);
      }
      return false;
    }, { timeoutMs: 30000, intervalMs: 350, label: 'quest combat objectives' });
    assert(state.quests.objectiveIndex >= 3, 'a real fight completes strike and slay objectives');

    const loot = await p.waitFor(async () => {
      const next = await p.state();
      return next.groundItems.find(item => !groundBefore.has(item.uuid)) || false;
    }, { label: 'quest monster drop' });
    p.devTeleport(loot.x, loot.y);
    await p.waitFor(async () => {
      const next = await p.state();
      return next.x === loot.x && next.y === loot.y;
    }, { label: 'reach quest loot' });
    await p.takeItem(loot);
    state = await p.waitFor(async () => {
      const next = await p.state();
      return next.quests.objectiveIndex >= 4 ? next : false;
    }, { label: 'quest loot objective' });
    assert(state.quests.objectiveIndex === 4, 'real context-menu pickup completes the loot objective');

    await p.enterZone('crypt', 'gauntlet');
    const completed = await p.waitFor(async () => {
      const next = await p.state();
      return next.quests.activeQuestId === 'proof-of-temper'
        && next.quests.completed.some(entry => entry.id === 'aldwyns-charge')
        ? next
        : false;
    }, { label: 'quest completion' });
    assert(completed.quests.questPoints === 1, 'quest grants one persistent passive point');
    const completedHouse = completed.chroniclesRecord.state.houses
      .find(entry => entry.id === house.id);
    const completedScion = completedHouse.scions.find(entry => entry.id === living.id);
    assert(completedHouse.renown === 5, 'quest grants five authoritative House renown');
    assert(completedScion.deeds.includes("Answered Aldwyn's Charge"),
      "the living Scion records Aldwyn's deed");

    const guardianScene = await p.state();
    const guardian = guardianScene.monsters.find(monster => monster.rarity === 'elite');
    assert(guardian, 'Proof of Temper finds an elite Adventure guardian');
    const guardianDropsBefore = new Set(guardianScene.groundItems.map(item => item.uuid));
    p.devSetLevel(20);
    p.devGive('vessel-khopesh', 1);
    const trainingWeapon = await p.waitFor(async () => {
      const next = await p.state();
      return next.inventoryDetails.find(item => item.id === 'vessel-khopesh') || false;
    }, { label: 'prepare guardian training weapon' });
    p.equipItem(trainingWeapon, 'right_hand');
    await p.waitFor(async () => {
      const next = await p.state();
      return next.wearDetails.right_hand?.uuid === trainingWeapon.uuid ? next : false;
    }, { label: 'equip guardian training weapon' });
    p.devHeal();
    p.devTeleport(guardian.x + 1, guardian.y);
    await p.attack(guardian);

    try {
      state = await p.waitFor(async () => {
        const next = await p.state();
        const livingGuardian = next.monsters.find(monster => monster.uuid === guardian.uuid);
        if (!livingGuardian && next.quests.objectiveIndex >= 1) {
          return next;
        }
        if (livingGuardian) {
          if (Math.abs(livingGuardian.x - next.x) > 1 || Math.abs(livingGuardian.y - next.y) > 1) {
            p.devTeleport(livingGuardian.x + 1, livingGuardian.y);
          }
          await p.attack(livingGuardian);
        }
        return false;
      }, { timeoutMs: 30000, intervalMs: 350, label: 'Proof of Temper guardian' });
    } catch (error) {
      const stalled = await p.state();
      const livingGuardian = stalled.monsters.find(monster => monster.uuid === guardian.uuid);
      throw new Error(`${error.message}; guardian=${JSON.stringify(livingGuardian)} player=${JSON.stringify({
        x: stalled.x,
        y: stalled.y,
        level: stalled.level,
        hp: stalled.hp,
        lifecycle: stalled.lifecycle,
      })}`);
    }
    assert(state.quests.objectiveIndex === 1, 'slaying an elite advances Proof of Temper');

    const questVessel = state.groundItems.find(item => (
      !guardianDropsBefore.has(item.uuid) && item.id.startsWith('vessel-')
    ));
    assert(questVessel, 'the quest guardian guarantees a native Vessel drop');
    p.devTeleport(questVessel.x, questVessel.y);
    await p.waitFor(async () => {
      const next = await p.state();
      return next.x === questVessel.x && next.y === questVessel.y;
    }, { label: 'reach Proof of Temper Vessel' });
    await p.takeItem(questVessel);
    state = await p.waitFor(async () => {
      const next = await p.state();
      return next.quests.objectiveIndex === 2 ? next : false;
    }, { label: 'claim Proof of Temper Vessel' });
    assert(state.inventoryDetails.some(item => item.uuid === questVessel.uuid),
      'the exact native Vessel enters the inventory');

    const carriedVessel = state.inventoryDetails.find(item => item.uuid === questVessel.uuid);
    p.equipItem(carriedVessel, carriedVessel.equipSlot);
    const tempered = await p.waitFor(async () => {
      const next = await p.state();
      return next.quests.activeQuestId === 'the-pale-crown'
        && next.quests.completed.some(entry => entry.id === 'proof-of-temper')
        ? next
        : false;
    }, { label: 'equip Proof of Temper Vessel' });
    assert(tempered.quests.questPoints === 2, 'two commissions grant two passive points');
    const temperedHouse = tempered.chroniclesRecord.state.houses
      .find(entry => entry.id === house.id);
    const temperedScion = temperedHouse.scions.find(entry => entry.id === living.id);
    assert(temperedHouse.renown === 15, 'the two commissions grant fifteen House renown');
    assert(temperedScion.deeds.includes('Proved their temper in the old realms'),
      'the Scion records the elite Vessel deed');

    // A crypt-themed zone with the wrong layout is not Weir Crypt and must
    // not satisfy a contextual objective merely because the tiles look alike.
    await p.enterZone('crypt', 'gauntlet');
    state = await p.state();
    assert(state.quests.activeQuestId === 'the-pale-crown'
      && state.quests.objectiveIndex === 0,
    'Sunken Colonnade cannot stand in for Weir Crypt');

    await p.enterZone('crypt', 'warren');
    state = await p.waitFor(async () => {
      const next = await p.state();
      return next.quests.activeQuestId === 'the-pale-crown'
        && next.quests.objectiveIndex === 1 ? next : false;
    }, { label: 'enter Weir Crypt for The Pale Crown' });
    assert(state.sceneName === 'Weir Crypt', 'the named campaign delve enters Weir Crypt');

    const sovereign = state.monsters.find(monster => (
      monster.rarity === 'elite' && monster.name === 'The Pale Sovereign'
    ));
    assert(sovereign, 'Weir Crypt is sealed by the named Pale Sovereign boss');
    p.devSetLevel(50);
    p.devHeal();
    p.devTeleport(sovereign.x + 1, sovereign.y);
    await p.attack(sovereign);
    state = await p.waitFor(async () => {
      const next = await p.state();
      const livingSovereign = next.monsters.find(monster => monster.uuid === sovereign.uuid);
      if (!livingSovereign && next.quests.objectiveIndex === 2) {
        return next;
      }
      if (!livingSovereign) {
        throw new Error(`Pale Sovereign died without quest progress: ${JSON.stringify(next.quests)}`);
      }
      if (livingSovereign) {
        p.devHeal();
        if (Math.abs(livingSovereign.x - next.x) > 1
          || Math.abs(livingSovereign.y - next.y) > 1) {
          p.devTeleport(livingSovereign.x + 1, livingSovereign.y);
        }
        await p.attack(livingSovereign);
      }
      return false;
    }, { timeoutMs: 30000, intervalMs: 350, label: 'Pale Sovereign campaign boss' });
    assert(state.quests.objectiveIndex === 2,
      'only the named crypt sovereign breaks the campaign seal');

    const stairsDown = state.sceneMetadata.stairsDown;
    assert(stairsDown, 'the broken seal exposes stairs to the deeper realm');
    p.devTeleport(stairsDown.x, stairsDown.y);
    const crowned = await p.waitFor(async () => {
      const next = await p.state();
      return next.sceneMetadata.depth === 2
        && next.quests.activeQuestId === 'rot-in-the-reeds'
        && next.quests.completed.some(entry => entry.id === 'the-pale-crown')
        ? next
        : false;
    }, { label: 'descend beneath the Pale Sovereign seal' });
    assert(crowned.quests.questPoints === 3, 'three commissions grant three passive points');
    const crownedHouse = crowned.chroniclesRecord.state.houses
      .find(entry => entry.id === house.id);
    const crownedScion = crownedHouse.scions.find(entry => entry.id === living.id);
    assert(crownedHouse.renown === 30, 'the campaign chain grants thirty House renown');
    assert(crownedScion.deeds.includes("Broke the Pale Sovereign's seal"),
      'the Scion records the named boss and descent deed');

    await p.enterZone('marsh', 'clearings');
    state = await p.waitFor(async () => {
      const next = await p.state();
      return next.quests.activeQuestId === 'rot-in-the-reeds'
        && next.quests.objectiveIndex === 1 ? next : false;
    }, { label: 'enter Marsh of Reeds for Rot in the Reeds' });
    assert(state.sceneName === 'Marsh of Reeds', 'the fourth commission enters its named marsh');

    const rotfather = state.monsters.find(monster => (
      monster.rarity === 'elite' && monster.name === 'The Rotfather'
    ));
    assert(rotfather, 'Marsh of Reeds is guarded by The Rotfather');
    const marshInventoryBefore = new Set(state.inventoryDetails.map(item => item.uuid));
    p.devGive('vessel-macuahuitl', 1, { seed: 12086, itemLevel: 80 });
    const marshWeapon = await p.waitFor(async () => {
      const next = await p.state();
      return next.inventoryDetails.find(item => (
        item.id === 'vessel-macuahuitl'
        && !marshInventoryBefore.has(item.uuid)
      )) || false;
    }, { label: 'prepare deterministic Rotfather weapon' });
    assert(marshWeapon.vessel.combat.modifiers.damageAgainstBeasts > 0,
      'the measured Rotfather setup carries live Beastbane damage');
    p.equipItem(marshWeapon, 'right_hand');
    await p.waitFor(async () => {
      const next = await p.state();
      return next.wearDetails.right_hand?.uuid === marshWeapon.uuid ? next : false;
    }, { label: 'equip deterministic Rotfather weapon' });
    p.devHeal();
    p.devTeleport(rotfather.x + 1, rotfather.y);
    await p.attack(rotfather);
    state = await p.waitFor(async () => {
      const next = await p.state();
      const livingRotfather = next.monsters.find(monster => monster.uuid === rotfather.uuid);
      if (!livingRotfather && next.quests.objectiveIndex === 2) {
        return next;
      }
      if (!livingRotfather) {
        throw new Error(`The Rotfather died without quest progress: ${JSON.stringify(next.quests)}`);
      }
      p.devHeal();
      if (Math.abs(livingRotfather.x - next.x) > 1
        || Math.abs(livingRotfather.y - next.y) > 1) {
        p.devTeleport(livingRotfather.x + 1, livingRotfather.y);
      }
      await p.attack(livingRotfather);
      return false;
    }, { timeoutMs: 30000, intervalMs: 350, label: 'Rotfather campaign boss' });
    assert(state.quests.objectiveIndex === 2,
      'only the named marsh sovereign advances the fourth commission');

    const marshExit = state.sceneMetadata.stairsUp;
    assert(marshExit, 'the cleared marsh retains its route to the surface');
    p.devTeleport(marshExit.x, marshExit.y);
    const reedsCleared = await p.waitFor(async () => {
      const next = await p.state();
      return next.sceneType === 'town'
        && next.quests.activeQuestId === null
        && next.quests.completed.some(entry => entry.id === 'rot-in-the-reeds')
        ? next
        : false;
    }, { label: 'return from Marsh of Reeds' });
    assert(reedsCleared.quests.questPoints === 4, 'four commissions grant four passive points');
    const reedsHouse = reedsCleared.chroniclesRecord.state.houses
      .find(entry => entry.id === house.id);
    const reedsScion = reedsHouse.scions.find(entry => entry.id === living.id);
    assert(reedsHouse.renown === 50, 'the four commissions grant fifty House renown');
    assert(reedsScion.deeds.includes('Ended the rot beneath the reeds'),
      'the Scion records the return from the blighted marsh');

    p.close();
    await new Promise(resolve => { setTimeout(resolve, 900); });
    p = await connect();
    const reloaded = await p.state();
    assert(reloaded.quests.questPoints === 4, 'all four quest points survive relogging');
    assert(reloaded.quests.completed.some(entry => entry.id === 'aldwyns-charge'),
      "Aldwyn's Charge survives relogging");
    assert(reloaded.quests.completed.some(entry => entry.id === 'proof-of-temper'),
      'Proof of Temper survives relogging');
    assert(reloaded.quests.completed.some(entry => entry.id === 'the-pale-crown'),
      'The Pale Crown survives relogging');
    assert(reloaded.quests.completed.some(entry => entry.id === 'rot-in-the-reeds'),
      'Rot in the Reeds survives relogging');
  } finally {
    p.close();
  }
}
