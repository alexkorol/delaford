/**
 * Progression loop: complete Aldwyn's first real commission through movement,
 * combat, loot, and instance entry; then relog and verify its passive point,
 * House renown, and Scion deed remain authoritative.
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
      return next.quests.activeQuestId === null
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

    p.close();
    await new Promise(resolve => { setTimeout(resolve, 900); });
    p = await connect();
    const reloaded = await p.state();
    assert(reloaded.quests.questPoints === 1, 'quest point survives relogging');
    assert(reloaded.quests.completed.some(entry => entry.id === 'aldwyns-charge'),
      'quest completion survives relogging');
  } finally {
    p.close();
  }
}
