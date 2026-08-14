/**
 * Vesselforge effects: equip deterministic Keen Eye, Wealthy, and Beastbane
 * gear, then prove all modifiers reach live combat rewards. The dev force only
 * removes critical-roll flakiness; generation, equip, damage, loot, creature
 * tags, and WebSocket payloads all use their production paths.
 */
export default async function vesselforge({ connect, assert }) {
  const p = await connect();
  try {
    let state = await p.state();
    if (state.wearDetails.ring?.combatBonuses?.goodsFound !== 10
      || state.combat.goodsFound !== 10) {
      p.devGive('vessel-ring', 1, { seed: 4, itemLevel: 40 });
      const ring = await p.waitFor(async () => {
        const next = await p.state();
        return next.inventoryDetails.find(item => (
          item.id === 'vessel-ring'
          && item.combatBonuses?.goodsFound === 10
        )) || false;
      }, { label: 'deterministic Wealthy ring' });
      p.equipItem(ring, 'ring');
      state = await p.waitFor(async () => {
        const next = await p.state();
        return next.wearDetails.ring?.uuid === ring.uuid ? next : false;
      }, { label: 'equip Wealthy ring' });
    }

    if (state.wearDetails.right_hand?.combatBonuses?.criticalChance !== 22
      || state.wearDetails.right_hand?.combatBonuses?.damageAgainstBeasts !== 13) {
      p.devGive('vessel-khopesh', 1, { seed: 1670, itemLevel: 40 });
      const weapon = await p.waitFor(async () => {
        const next = await p.state();
        return next.inventoryDetails.find(item => (
          item.id === 'vessel-khopesh'
          && item.combatBonuses?.criticalChance === 22
          && item.combatBonuses?.damageAgainstBeasts === 13
        )) || false;
      }, { label: 'deterministic Keen Eye weapon' });
      p.equipItem(weapon, 'right_hand');
      state = await p.waitFor(async () => {
        const next = await p.state();
        return next.wearDetails.right_hand?.uuid === weapon.uuid ? next : false;
      }, { label: 'equip Keen Eye weapon' });
    }

    assert(state.combat.criticalChance > 0,
      `Keen Eye reaches combat state (${state.combat.criticalChance}%)`);
    assert(state.wearDetails.right_hand.vessel.lines.some(line => (
      line.section === 'brand' && /Critical Chance/.test(line.text)
    )), 'Keen Eye is presented as a live Brand');
    const equippedGoodsFound = Math.min(100, Object.values(state.wearDetails)
      .reduce((total, item) => total + (item?.combatBonuses?.goodsFound || 0), 0));
    assert(state.wearDetails.ring.combatBonuses?.goodsFound === 10,
      'the deterministic Wealthy ring contributes its 10% Brand');
    assert(state.combat.goodsFound === equippedGoodsFound,
      `Wealthy reaches combat state (${state.combat.goodsFound}%)`);
    assert(state.wearDetails.ring.vessel.lines.some(line => (
      line.section === 'brand' && /Item Find/.test(line.text)
    )), 'Wealthy is presented as a live Brand');
    assert(state.combat.damageAgainstBeasts === 13,
      'Beastbane reaches combat state (13%)');
    assert(state.wearDetails.right_hand.vessel.lines.some(line => (
      line.section === 'brand' && /Damage against Beasts/.test(line.text)
    )), 'Beastbane is presented as a live Brand');

    await p.enterZone('dungeon', 'warren');
    p.devSetLevel(50);
    p.devHeal();
    const scene = await p.state();
    const groundBefore = new Set(scene.groundItems.map(item => item.uuid));
    const target = scene.monsters
      .filter(monster => monster.rarity !== 'elite')
      .sort((a, b) => (Math.abs(a.x - scene.x) + Math.abs(a.y - scene.y))
        - (Math.abs(b.x - scene.x) + Math.abs(b.y - scene.y)))[0];
    assert(target, 'found a target for the critical strike');
    assert(target.coins > 0, 'target carries a measurable coin bounty');

    p.devTeleport(target.x + 1, target.y);
    p.devForceCritical();
    await p.attack(target);
    const hit = await p.waitFor(() => p.hits.find(entry => entry.critical) || false, {
      timeoutMs: 3000,
      intervalMs: 25,
      label: 'critical combat event',
    });
    const expected = Math.max(hit.baseAmount + 1, Math.round(hit.baseAmount * 1.5));
    assert(hit.amount === expected,
      `critical hit deals the measured 1.5x result (${hit.baseAmount} -> ${hit.amount})`);

    const boostedCoins = Math.floor(target.coins * (1 + (state.combat.goodsFound / 100)));
    const coin = await p.waitFor(async () => {
      const next = await p.state();
      const fresh = next.groundItems.find(item => (
        item.id === 'coins'
        && item.qty === boostedCoins
        && !groundBefore.has(item.uuid)
      ));
      if (fresh) return fresh;
      const stillAlive = next.monsters.find(monster => monster.uuid === target.uuid);
      if (stillAlive) {
        p.devTeleport(Math.round(stillAlive.x) + 1, Math.round(stillAlive.y));
        await p.attack(stillAlive);
      }
      return false;
    }, { timeoutMs: 10000, intervalMs: 250, label: 'Wealthy coin drop' });
    assert(coin.qty === boostedCoins,
      `Wealthy boosts the real coin bounty by ${state.combat.goodsFound}% (${target.coins} -> ${coin.qty})`);

    await p.enterZone('grove', 'clearings');
    const grove = await p.state();
    const beast = grove.monsters
      .filter(monster => monster.tags.includes('beast'))
      .sort((a, b) => (Math.abs(a.x - grove.x) + Math.abs(a.y - grove.y))
        - (Math.abs(b.x - grove.x) + Math.abs(b.y - grove.y)))[0];
    assert(beast, 'the generated grove exposes an explicitly tagged beast');

    const hitsBeforeBeast = p.hits.length;
    const beastHit = await p.waitFor(async () => {
      const hitOnBeast = p.hits.slice(hitsBeforeBeast)
        .find(entry => entry.targetId === beast.uuid && entry.beastbane);
      if (hitOnBeast) return hitOnBeast;
      const next = await p.state();
      const stillAlive = next.monsters.find(monster => monster.uuid === beast.uuid);
      if (stillAlive) {
        p.devTeleport(Math.round(stillAlive.x) + 1, Math.round(stillAlive.y));
        await p.attack(stillAlive);
      }
      return false;
    }, { timeoutMs: 10000, intervalMs: 250, label: 'Beastbane combat event' });
    const beastbaneDamage = Math.round(beastHit.baseAmount * 1.13);
    assert(beastHit.beastbaneAmount === beastbaneDamage,
      `Beastbane applies the measured 13% bonus (${beastHit.baseAmount} -> ${beastHit.beastbaneAmount})`);
  } finally {
    p.close();
  }
}
