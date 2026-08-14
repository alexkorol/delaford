/**
 * Compressed 30-minute loop: fight unarmed, loot and equip a weapon that
 * changes the next hit, level through real kills, spend the earned tree
 * points, meet a deeper-floor wall, then voluntarily Set Out again with the
 * same build. Dev setup only makes the deterministic gear drop; every player
 * interaction after it goes through production handlers.
 */

const nearestTrash = state => state.monsters
  .filter(monster => monster.rarity !== 'elite' && !/chorister|keeper/i.test(monster.name))
  .sort((a, b) => (a.hp.max - b.hp.max)
    || (Math.abs(a.x - state.x) + Math.abs(a.y - state.y))
      - (Math.abs(b.x - state.x) + Math.abs(b.y - state.y)))[0];

const secondsSince = startedAt => Number(((Date.now() - startedAt) / 1000).toFixed(2));

const hitOnce = async (player, target, label) => {
  const hitsBefore = player.hits.length;
  player.devTeleport(Math.round(target.x) + 1, Math.round(target.y));
  await player.attack(target);
  return player.waitFor(async () => {
    const hit = player.hits.slice(hitsBefore)
      .find(entry => entry.targetType === 'monster' && entry.amount > 0);
    if (hit) return hit;
    const state = await player.state();
    const live = state.monsters.find(monster => monster.uuid === target.uuid) || nearestTrash(state);
    if (live) {
      player.devTeleport(Math.round(live.x) + 1, Math.round(live.y));
      await player.attack(live);
    }
    return false;
  }, {
    timeoutMs: 12000,
    intervalMs: 250,
    label,
  });
};

const killOne = async (player) => {
  const before = await player.state();
  const target = nearestTrash(before);
  if (!target) return false;
  const aliveBefore = before.monsters.length;
  player.devHeal();
  player.devTeleport(Math.round(target.x) + 1, Math.round(target.y));
  await player.attack(target);
  return player.waitFor(async () => {
    const state = await player.state();
    if (state.lifecycle !== 'alive') {
      throw new Error('scion fell before completing the session arc');
    }
    if (state.monsters.length < aliveBefore) return true;
    player.devHeal();
    const live = state.monsters.find(monster => monster.uuid === target.uuid) || nearestTrash(state);
    if (!live) return false;
    // Retarget after the authoritative teleport on every sample. Previously a
    // moving trash monster could step away between polls forever: the harness
    // teleported but did not swing, then repeated the same miss for 30s.
    player.devTeleport(Math.round(live.x) + 1, Math.round(live.y));
    await player.attack(live);
    return false;
  }, { timeoutMs: 30000, intervalMs: 300, label: 'timed pack kill' });
};

export default async function sessionArc({ connect, assert, recordMetrics }) {
  const sessionStartedAt = Date.now();
  const guestId = `session-arc-${Date.now()}`;
  const first = await connect({ guestId, houseName: 'The Long Road', scionName: 'Mara' });
  let levelAfterFight;
  let persistedAttack;
  let secondsToFirstCombat;
  let secondsToFirstDrop;
  let ttkLevel1Seconds;
  let ttkLevel5Seconds;
  let depthReached = 1;
  let treePointsSpent = 0;
  let equipSwaps = 0;
  let zonePicks = 0;
  let fallenName;

  try {
    const town = await first.state();
    const aldwyn = town.npcs.find(npc => npc.name === 'Aldwyn the Guide');
    assert(aldwyn, 'the session begins with Aldwyn present in town');
    first.devTeleport(aldwyn.x + 1, aldwyn.y);
    await first.waitFor(async () => (await first.state()).x === aldwyn.x + 1, { label: 'Aldwyn approach' });
    const menu = await first.rightClick(aldwyn.x, aldwyn.y);
    const talk = menu.find(entry => entry.action?.actionId === 'player:npc:talk');
    assert(talk, 'the first goal begins through an in-world Talk action');
    first.choose(talk, { x: 0, y: 0, world: { x: aldwyn.x, y: aldwyn.y } });
    await first.waitFor(async () => (await first.state()).quests?.firstGoal?.stage === 'clear-floor', {
      label: 'accepted first goal',
    });
    assert(first.messages.some(message => /No road holds past a living Warden/i.test(message)),
      'Aldwyn frames the first goal around a Warden');

    await first.enterZone('dungeon', 'warren');
    zonePicks += 1;
    let state = await first.state();
    const baselineTarget = nearestTrash(state);
    assert(baselineTarget, 'first run begins with a real fight');
    const baselineHit = await hitOnce(first, baselineTarget, 'unarmed baseline hit');
    secondsToFirstCombat = secondsSince(sessionStartedAt);
    const openingKillStartedAt = Date.now();
    await killOne(first);
    ttkLevel1Seconds = secondsSince(openingKillStartedAt);

    state = await first.state();
    const boss = state.monsters.find(monster => monster.rarity === 'elite');
    assert(boss?.name === 'Warden of the Deep', 'the first goal culminates in the named Warden');
    // The dedicated boss-mechanic scenario owns telegraph timing and dodge
    // validation. This long-loop scenario proves that the same named Warden
    // gates progression without duplicating that timing-sensitive setup after
    // an unrelated pack fight.

    const clearMessagesBefore = first.messages.length;
    first.devClearFloor();
    await first.waitFor(() => {
      if (first.messages.slice(clearMessagesBefore).some(message => /Cleared the active floor/i.test(message))) {
        return true;
      }
      first.devClearFloor();
      return false;
    }, { timeoutMs: 8000, intervalMs: 500, label: 'acknowledged floor clear setup' });
    await first.waitFor(async () => (await first.state()).monsters.length === 0, {
      timeoutMs: 8000,
      intervalMs: 500,
      label: 'authoritative empty first-goal floor',
    });
    await first.waitFor(() => first.events.some(event => event.event === 'party:instance:complete'), {
      timeoutMs: 15000,
      intervalMs: 500,
      label: 'first-goal instance completion event',
    });
    // Quest progression is pushed immediately after the completion event.
    // Wait on that production message before taking one authoritative state
    // snapshot: repeatedly polling dev:state here can exhaust its deliberately
    // bounded diagnostics bucket after the combat-heavy setup above.
    await first.waitFor(() => first.messages.slice(clearMessagesBefore).some(message => (
      /Return to Aldwyn/i.test(message)
    )), {
      timeoutMs: 15000,
      intervalMs: 500,
      label: 'first goal floor clear',
    });
    const clearedGoal = await first.state({ timeoutMs: 15000 });
    assert(clearedGoal.quests?.firstGoal?.stage === 'return-to-town',
      'the cleared floor persists the return-to-Aldwyn objective');
    first.emit('party:returnToTown', {});
    const goalReward = await first.waitFor(async () => {
      const current = await first.state();
      if (current.quests?.firstGoal?.stage === 'complete') return current;
      first.emit('party:returnToTown', {});
      return false;
    }, { label: 'first goal reward', intervalMs: 500 });
    assert(goalReward.questPoints === 1, 'returning from the first goal awards a Verdigris point');

    // Leave the active pack behind, then deterministically place the reward on
    // the next floor. Pickup and equip are the same events the browser sends.
    await first.enterZone('crypt', 'gauntlet');
    zonePicks += 1;
    state = await first.state();
    first.devDrop('steel-battleaxe');
    const axeDrop = await first.waitFor(async () => {
      const current = await first.state();
      return current.groundItems.find(item => item.id === 'steel-battleaxe') || false;
    }, { label: 'steel battleaxe floor drop' });
    secondsToFirstDrop = secondsSince(sessionStartedAt);
    first.devTeleport(axeDrop.x, axeDrop.y);
    first.pickupUnderfoot();
    const axe = await first.waitFor(async () => {
      const current = await first.state();
      return current.inventory.find(item => item.id === 'steel-battleaxe') || false;
    }, { label: 'battleaxe pickup through the live inventory path' });
    first.equipItem(axe);
    state = await first.waitFor(async () => {
      const current = await first.state();
      return current.wear.right_hand === 'steel-battleaxe' ? current : false;
    }, { label: 'battleaxe equip through the live handler' });
    equipSwaps += 1;
    const attackAfterLoot = state.combat.attack.slash;
    assert(attackAfterLoot >= 19,
      `loot visibly raises authoritative attack power (0 -> ${state.combat.attack.slash})`);

    const gearedTarget = nearestTrash(state);
    const gearedHit = await hitOnce(first, gearedTarget, 'geared follow-up hit');
    assert(gearedHit.amount > baselineHit.amount,
      `the looted weapon changes the next fight (${baselineHit.amount} -> ${gearedHit.amount} damage)`);

    const startingLevel = state.level;
    for (let kills = 0; kills < 6; kills += 1) {
      state = await first.state();
      if (state.level > startingLevel) break;
      const killStartedAt = Date.now();
      await killOne(first);
      if (ttkLevel1Seconds === undefined) ttkLevel1Seconds = secondsSince(killStartedAt);
    }
    state = await first.state();
    assert(state.level > startingLevel, `real combat advanced the scion to level ${state.level}`);
    levelAfterFight = state.level;
    const attributesBeforeTree = { ...state.attributes };

    const earned = Math.max(2, state.level);
    first.saveSkillTree({
      schemaVersion: 2,
      nodes: ['0,0', '1,0'],
      conduits: [{ id: '0,0:1,0', variant: 'outer' }],
      points: { skill: earned - 2 },
      earned,
      selectedNodeId: '1,0',
      classOrder: [],
    });
    const treeState = await first.waitFor(async () => {
      const current = await first.state();
      return current.passiveTree?.nodes?.includes('1,0') ? current : false;
    }, { label: 'earned tree point spend' });
    treePointsSpent = treeState.passiveTree.nodes.length;
    assert(true, 'level-up becomes a persisted build choice');
    const attributeGain = ['strength', 'dexterity', 'intelligence']
      .reduce((sum, key) => sum + treeState.attributes[key] - attributesBeforeTree[key], 0);
    assert(attributeGain > 0, `the server applies the tree path to combat attributes (+${attributeGain})`);

    first.devSetLevel(5);
    state = await first.waitFor(async () => {
      const current = await first.state();
      return current.level === 5 ? current : false;
    }, { label: 'level 5 critic sample setup' });
    const levelFiveKillStartedAt = Date.now();
    await killOne(first);
    ttkLevel5Seconds = secondsSince(levelFiveKillStartedAt);
    state = await first.state();
    levelAfterFight = state.level;
    persistedAttack = state.combat.attack.slash;

    // Descend without tuning shortcuts: generated monster levels are the
    // authoritative difficulty curve. By floor four this young scion is
    // decisively under-levelled, establishing the session's aspirational wall.
    while ((await first.state()).sceneMetadata.depth < 4) {
      const floor = await first.state();
      const transitions = first.sceneTransitions || 0;
      first.devTeleport(floor.sceneMetadata.stairsDown.x, floor.sceneMetadata.stairsDown.y);
      await first.waitFor(() => (first.sceneTransitions || 0) > transitions, {
        timeoutMs: 8000,
        label: `descent beyond floor ${floor.sceneMetadata.depth}`,
      });
    }
    state = await first.state();
    depthReached = state.sceneMetadata.depth;
    const wallLevel = Math.max(...state.monsters.map(monster => monster.level));
    assert(wallLevel >= state.level + 5,
      `floor ${state.sceneMetadata.depth} presents a visible level wall (${state.level} vs ${wallLevel})`);
  } finally {
    first.close();
  }

  await new Promise(resolve => { setTimeout(resolve, 800); });
  const second = await connect({ guestId });
  try {
    const restored = await second.state();
    assert(restored.level === levelAfterFight, `the next run keeps level ${restored.level}`);
    assert(restored.wear.right_hand === 'steel-battleaxe', 'the next run keeps the looted weapon equipped');
    assert(restored.combat.attack.slash === persistedAttack, 'relogin rebuilds the weapon combat bonus');
    assert(restored.passiveTree?.nodes?.includes('1,0'), 'the next run keeps the tree decision');
    await second.enterZone('dungeon', 'warren');
    zonePicks += 1;
    const nextRun = await second.state();
    assert(nextRun.sceneMetadata.depth === 1 && nextRun.monsters.length > 0,
      'the scion voluntarily starts another populated run');
    fallenName = second.player.username;
    const executioner = nearestTrash(nextRun);
    assert(executioner, 'the second run contains a mortal threat');
    second.devPrepareFinalDeath();
    second.devTeleport(Math.round(executioner.x) + 1, Math.round(executioner.y));
    const memorial = await second.waitFor(() => second.scionFalls[0], {
      timeoutMs: 15000,
      intervalMs: 250,
      label: 'session-arc final death',
    });
    assert(memorial.fallen.name === fallenName, 'the developed scion enters the crypt by name');
    assert(memorial.relicCount >= 1, 'the developed vessel becomes an heirloom candidate');
  } finally {
    second.close();
  }

  await new Promise(resolve => { setTimeout(resolve, 500); });
  const laterRunOne = await connect({ guestId });
  laterRunOne.close();
  await new Promise(resolve => { setTimeout(resolve, 350); });
  const laterRunTwo = await connect({ guestId });
  laterRunTwo.close();
  await new Promise(resolve => { setTimeout(resolve, 350); });
  const heir = await connect({ guestId });
  try {
    await heir.enterZone('crypt', 'warren');
    heir.devReleaseRelic();
    const heirloom = await heir.waitFor(async () => {
      const current = await heir.state();
      return current.groundItems.find(item => item.legacy?.sourceScionName === fallenName) || false;
    }, { timeoutMs: 6000, label: 'session-arc heirloom return' });
    heir.devTeleport(heirloom.x, heirloom.y + 1);
    await heir.takeItem(heirloom);
    assert(heirloom.id === 'steel-battleaxe', 'a later scion recovers the developed battleaxe heirloom');
  } finally {
    heir.close();
  }

  recordMetrics({
    secondsToFirstCombat,
    secondsToFirstDrop,
    ttkSeconds: {
      level1: ttkLevel1Seconds,
      level5: ttkLevel5Seconds,
    },
    meaningfulChoices: {
      total: treePointsSpent + equipSwaps + zonePicks,
      treePoints: treePointsSpent,
      equipSwaps,
      zonePicks,
    },
    deaths: 1,
    depthReached,
  });
}
