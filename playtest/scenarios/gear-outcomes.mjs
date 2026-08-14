const nearestStableTarget = state => state.monsters
  .filter(monster => monster.rarity !== 'elite' && !/chorister|keeper/i.test(monster.name))
  .sort((a, b) => (a.hp.max - b.hp.max)
    || (Math.abs(a.x - state.x) + Math.abs(a.y - state.y))
      - (Math.abs(b.x - state.x) + Math.abs(b.y - state.y)))[0];

const timeKill = async (player, targetUuid) => {
  const state = await player.state();
  const target = state.monsters.find(monster => monster.uuid === targetUuid);
  if (!target) throw new Error('comparison monster is not alive');
  player.devHeal();
  player.devTeleport(Math.round(target.x) + 1, Math.round(target.y));
  const startedAt = Date.now();
  await player.attack(target);
  await player.waitFor(async () => {
    const current = await player.state();
    if (current.lifecycle !== 'alive') throw new Error('scion fell during gear comparison');
    player.devHeal();
    const live = current.monsters.find(monster => monster.uuid === targetUuid);
    if (!live) return true;
    player.devTeleport(Math.round(live.x) + 1, Math.round(live.y));
    await player.attack(live);
    return false;
  }, { timeoutMs: 30000, intervalMs: 250, label: `kill of comparison monster ${targetUuid}` });
  return (Date.now() - startedAt) / 1000;
};

const COMPARISON_HEALTH = 100;
// The deeper comparison must span enough attack cycles that one scheduling
// interval cannot erase the measured item-level advantage. At 240 health the
// same 13 -> 17 attack increase could report anywhere from 7% to 18% faster
// depending on which 250ms poll observed the final hit.
const DEEP_COMPARISON_HEALTH = 720;

const resetMonster = async (player, targetUuid, maxHealth = COMPARISON_HEALTH) => {
  player.devResetMonster(targetUuid, { maxHealth, isolate: true });
  return player.waitFor(async () => {
    const state = await player.state();
    const target = state.monsters.find(monster => monster.uuid === targetUuid);
    return target && target.hp.current === maxHealth
      && target.hp.max === maxHealth ? target : false;
  }, { label: 'same comparison monster reset to full health' });
};

const lootAndEquip = async (player, itemLevel) => {
  // The development-control rate bucket can drop a single dev:drop while the
  // heal/teleport trial loop is running hot; re-request the idempotent drop
  // (same seed => same roll) until it lands, like state() does for dev:state.
  let lastRequestAt = 0;
  const drop = await player.waitFor(async () => {
    if (Date.now() - lastRequestAt > 2000) {
      lastRequestAt = Date.now();
      player.devDrop('vessel-handaxe', { itemLevel, seed: 3493 });
    }
    const state = await player.state();
    return state.groundItems.find(item => item.id === 'vessel-handaxe'
      && item.itemLevel === itemLevel) || false;
  }, { timeoutMs: 12000, label: `item-level ${itemLevel} vessel drop` });
  player.devTeleport(drop.x, drop.y);
  player.pickupUnderfoot();
  let lastPickupAt = Date.now();
  const inventoryItem = await player.waitFor(async () => {
    const state = await player.state();
    const pickedUp = state.inventory.find(item => item.uuid === drop.uuid);
    if (pickedUp) return pickedUp;

    // The dev teleport and the real pickup travel through separate socket
    // handlers. Under a busy full-suite server the first grab can race the
    // authoritative teleport; retrying the idempotent grab models holding G
    // for a moment instead of turning scheduler jitter into a false failure.
    if (Date.now() - lastPickupAt >= 750) {
      lastPickupAt = Date.now();
      player.devTeleport(drop.x, drop.y);
      player.pickupUnderfoot();
    }
    return false;
  }, { timeoutMs: 12000, label: `item-level ${itemLevel} vessel pickup` });
  player.equipItem(inventoryItem);
  return player.waitFor(async () => {
    const state = await player.state();
    return state.wornItems?.right_hand?.uuid === drop.uuid ? state : false;
  }, { label: `item-level ${itemLevel} vessel equip` });
};

export default async function gearOutcomes({ connect, assert }) {
  const player = await connect({ guestId: `gear-outcomes-${Date.now()}` });
  try {
    await player.enterZone('dungeon', 'warren');
    player.devSetLevel(5);
    player.devHeal();
    const initial = await player.state();
    const target = nearestStableTarget(initial);
    assert(target, 'found one stable monster for all three gear trials');

    await resetMonster(player, target.uuid);
    const unarmedTtk = await timeKill(player, target.uuid);
    await resetMonster(player, target.uuid);

    const lowState = await lootAndEquip(player, 5);
    const lowAttack = lowState.combat.attack.slash;
    const lowTtk = await timeKill(player, target.uuid);
    await resetMonster(player, target.uuid, DEEP_COMPARISON_HEALTH);
    const lowDeepTtk = await timeKill(player, target.uuid);
    await resetMonster(player, target.uuid, DEEP_COMPARISON_HEALTH);

    const highState = await lootAndEquip(player, 65);
    const highAttack = highState.combat.attack.slash;
    assert(highAttack >= lowAttack + 3,
      `higher-ilvl vessel visibly raises attack (${lowAttack} -> ${highAttack})`);
    const highTtk = await timeKill(player, target.uuid);

    assert(unarmedTtk >= lowTtk * 1.25,
      `looted weapon cuts same-monster TTK by at least 20% (${unarmedTtk.toFixed(2)}s -> ${lowTtk.toFixed(2)}s)`);
    assert(lowDeepTtk >= highTtk * 1.15,
      `higher-ilvl vessel cuts same-monster TTK by at least 13% (${lowDeepTtk.toFixed(2)}s -> ${highTtk.toFixed(2)}s)`);
  } finally {
    player.close();
  }
}
