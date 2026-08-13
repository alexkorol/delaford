/**
 * Vesselforge effects: equip a deterministic Keen Eye weapon, then prove the
 * chance reaches the live combat event as an exact 1.5x critical hit. The dev
 * force only removes random flakiness; generation, equip, damage, and the
 * WebSocket `combat:hit` payload all use their production paths.
 */
export default async function vesselforge({ connect, assert }) {
  const p = await connect();
  try {
    let state = await p.state();
    if (!state.wearDetails.right_hand?.combatBonuses?.criticalChance) {
      p.devGive('vessel-khopesh', 1, { seed: 539, itemLevel: 40 });
      const weapon = await p.waitFor(async () => {
        const next = await p.state();
        return next.inventoryDetails.find(item => (
          item.id === 'vessel-khopesh'
          && item.combatBonuses?.criticalChance === 22
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

    await p.enterZone('dungeon', 'warren');
    p.devSetLevel(5);
    p.devHeal();
    const scene = await p.state();
    const target = scene.monsters
      .filter(monster => monster.rarity !== 'elite')
      .sort((a, b) => (Math.abs(a.x - scene.x) + Math.abs(a.y - scene.y))
        - (Math.abs(b.x - scene.x) + Math.abs(b.y - scene.y)))[0];
    assert(target, 'found a target for the critical strike');

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
  } finally {
    p.close();
  }
}
