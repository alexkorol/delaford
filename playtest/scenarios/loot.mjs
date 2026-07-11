/**
 * Core loop: LOOT. Equipment remains a deliberate Take interaction while
 * monster gold flows into the backpack automatically at melee distance.
 */
export default async function loot({ connect, assert }) {
  const p = await connect();
  try {
    await p.enterZone('dungeon', 'warren');
    p.devSetLevel(5);
    p.devHeal();

    // Exercise the real context-menu Take path with equipment.
    p.devDrop('bronze-sword');
    const sword = await p.waitFor(async () => {
      const s = await p.state();
      return s.groundItems.find(item => item.id === 'bronze-sword') || false;
    }, { label: 'equipment drop' });
    p.devTeleport(sword.x, sword.y + 1);
    await p.waitFor(async () => (await p.state()).y === sword.y + 1, { label: 'equipment pickup approach' });
    let menu = await p.rightClick(sword.x, sword.y);
    let hasTake = menu.some(entry => entry.action?.actionId === 'player:take');
    if (!hasTake) {
      menu = await p.rightClick(sword.x, sword.y);
      hasTake = menu.some(entry => entry.action?.actionId === 'player:take');
    }
    assert(hasTake, `equipment exposes the real Take action (${menu
      .map(entry => `${entry.action?.actionId || entry.action?.name}:${entry.label}`)
      .join(' | ') || 'empty menu'})`);
    await p.takeItem(sword);
    assert((await p.state()).inventory.some(item => item.id === 'bronze-sword'), 'taken equipment enters inventory');

    let scene = await p.state();
    const coinsBefore = scene.inventory
      .filter(item => item.id === 'coins')
      .reduce((sum, item) => sum + (item.qty || 0), 0);
    const target = scene.monsters
      .filter(monster => monster.rarity !== 'elite')
      .sort((a, b) => (Math.abs(a.x - scene.x) + Math.abs(a.y - scene.y))
        - (Math.abs(b.x - scene.x) + Math.abs(b.y - scene.y)))[0];
    assert(target, 'found a monster to loot');
    p.devTeleport(Math.round(target.x) + 1, Math.round(target.y));
    await p.attack(target);

    await p.waitFor(async () => {
      const s = await p.state();
      if (s.lifecycle !== 'alive') p.devHeal();
      const coins = s.inventory
        .filter(item => item.id === 'coins')
        .reduce((sum, item) => sum + (item.qty || 0), 0);
      if (coins > coinsBefore) return true;
      const nearest = s.monsters
        .filter(monster => monster.rarity !== 'elite')
        .sort((a, b) => (Math.abs(a.x - s.x) + Math.abs(a.y - s.y))
          - (Math.abs(b.x - s.x) + Math.abs(b.y - s.y)))[0];
      if (nearest && Math.abs(nearest.x - s.x) <= 1.6 && Math.abs(nearest.y - s.y) <= 1.6) {
        await p.attack(nearest);
      } else if (nearest) {
        p.devTeleport(Math.round(nearest.x) + 1, Math.round(nearest.y));
      }
      return false;
    }, { timeoutMs: 30000, intervalMs: 400, label: 'automatic monster-gold pickup' });
    assert(true, 'monster gold is collected automatically');

    // Keep the keyboard grab path covered for non-currency loot.
    p.devDrop('bronze-shield');
    const shield = await p.waitFor(async () => {
      const s = await p.state();
      return s.groundItems.find(item => item.id === 'bronze-shield') || false;
    }, { label: 'underfoot equipment drop' });
    p.devTeleport(shield.x, shield.y);
    p.pickupUnderfoot();
    await p.waitFor(async () => {
      const shieldRemains = (await p.state()).groundItems.some(item => item.uuid === shield.uuid);
      if (shieldRemains) p.pickupUnderfoot();
      return !shieldRemains;
    }, {
      timeoutMs: 6000,
      label: 'underfoot equipment pickup',
    });
  } finally {
    p.close();
  }
}
