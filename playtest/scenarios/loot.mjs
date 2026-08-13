/**
 * Core loop: LOOT. Kill a monster, watch its drop hit the floor, right-click
 * it through the REAL server-built context menu, Take it, and see it in the
 * inventory. Regression: the Take flow was unreachable when right-click was
 * dead, and coins always drop so this is deterministic.
 */
export default async function loot({ connect, assert }) {
  const p = await connect();
  try {
    await p.enterZone('dungeon', 'warren');
    p.devSetLevel(5);
    p.devHeal();

    let scene = await p.state();
    const target = scene.monsters
      .filter(m => m.rarity !== 'elite')
      .sort((a, b) => (Math.abs(a.x - scene.x) + Math.abs(a.y - scene.y))
        - (Math.abs(b.x - scene.x) + Math.abs(b.y - scene.y)))[0];
    assert(target, 'found a monster to loot');
    p.devTeleport(target.x + 1, target.y);
    await p.attack(target);

    // Wait for the kill and its coin drop.
    const drop = await p.waitFor(async () => {
      const s = await p.state();
      if (s.lifecycle !== 'alive') {
        p.devHeal();
      }
      const coins = s.groundItems.find(item => item.id === 'coins');
      if (coins) {
        return coins;
      }
      const nearest = s.monsters
        .filter(m => m.rarity !== 'elite')
        .sort((a, b) => (Math.abs(a.x - s.x) + Math.abs(a.y - s.y))
          - (Math.abs(b.x - s.x) + Math.abs(b.y - s.y)))[0];
      if (nearest && Math.abs(nearest.x - s.x) <= 1 && Math.abs(nearest.y - s.y) <= 1) {
        await p.attack(nearest);
      } else if (nearest) {
        p.devTeleport(nearest.x + 1, nearest.y);
      }
      return false;
    }, { timeoutMs: 30000, intervalMs: 400, label: 'a coin drop' });

    // The real menu must offer Take for it.
    // A fixed adjacent offset can itself be a blocked dungeon tile, leaving a
    // queued Take path with nowhere to start. Stand on the drop through the
    // dev movement path, as the quest scenario does, then exercise the same
    // real server-built right-click menu and Take action.
    p.devTeleport(drop.x, drop.y);
    const before = await p.waitFor(async () => {
      const state = await p.state();
      return state.x === drop.x && state.y === drop.y ? state : false;
    }, { timeoutMs: 6000, label: 'reach the first drop' });
    const coinsBefore = before.inventory
      .filter(item => item.id === 'coins')
      .reduce((sum, item) => sum + (item.qty || 0), 0);

    await p.takeItem(drop);

    scene = await p.state();
    const coinsAfter = scene.inventory
      .filter(item => item.id === 'coins')
      .reduce((sum, item) => sum + (item.qty || 0), 0);
    assert(coinsAfter > coinsBefore, `coins entered the inventory (${coinsBefore} -> ${coinsAfter})`);

    // Underfoot grab key: kill another mob, stand ON its drop, press grab.
    const drop2 = await p.waitFor(async () => {
      const s = await p.state();
      if (s.lifecycle !== 'alive') p.devHeal();
      const coins = s.groundItems.find(item => item.id === 'coins');
      if (coins) return coins;
      const nearest = s.monsters
        .filter(m => m.rarity !== 'elite')
        .sort((a, b) => (Math.abs(a.x - s.x) + Math.abs(a.y - s.y))
          - (Math.abs(b.x - s.x) + Math.abs(b.y - s.y)))[0];
      if (nearest && Math.abs(nearest.x - s.x) <= 1.6 && Math.abs(nearest.y - s.y) <= 1.6) {
        await p.attack(nearest);
      } else if (nearest) {
        p.devTeleport(Math.round(nearest.x) + 1, Math.round(nearest.y));
      }
      return false;
    }, { timeoutMs: 30000, intervalMs: 400, label: 'a second coin drop' });

    p.devTeleport(drop2.x, drop2.y); // stand ON it
    const underfoot = await p.waitFor(async () => {
      const s = await p.state();
      if (s.x !== drop2.x || s.y !== drop2.y) return false;
      const reachable = s.groundItems.filter(item => (
        (item.x === s.x && item.y === s.y)
        || (Math.abs(item.x - s.x) + Math.abs(item.y - s.y) === 1)
      ));
      return reachable.some(item => item.uuid === drop2.uuid)
        ? { uuids: new Set(reachable.map(item => item.uuid)) }
        : false;
    }, { timeoutMs: 6000, label: 'standing on the second drop' });

    p.pickupUnderfoot();
    await p.waitFor(async () => {
      const s = await p.state();
      // The grab key intentionally takes one reachable item. A gear roll can
      // share the monster's tile with its guaranteed coins, so assert the
      // real one-key contract instead of requiring a particular stack.
      const remaining = new Set(s.groundItems.map(item => item.uuid));
      return [...underfoot.uuids].some(uuid => !remaining.has(uuid));
    }, { timeoutMs: 6000, label: 'underfoot pickup' });
  } finally {
    p.close();
  }
}
