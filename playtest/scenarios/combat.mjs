/**
 * Core loop: FIGHT. Enter a zone whose packs include a support healer, engage
 * a pack, and actually kill something within a sane time while surviving.
 * Regression: healers used to out-heal the player 3-20x — nothing could die.
 */
export default async function combat({ connect, assert }) {
  const p = await connect();
  try {
    await p.enterZone('grove', 'clearings'); // grove packs include Grovekeeper healers
    p.devSetLevel(5);
    p.devHeal();

    const scene = await p.state();
    assert(scene.monsters.length >= 20, `instance is populated (${scene.monsters.length} monsters)`);

    // Walk up to the nearest non-elite monster.
    const target = scene.monsters
      .filter(m => m.rarity !== 'elite')
      .sort((a, b) => (Math.abs(a.x - scene.x) + Math.abs(a.y - scene.y))
        - (Math.abs(b.x - scene.x) + Math.abs(b.y - scene.y)))[0];
    assert(target, 'found a trash monster to fight');
    p.devTeleport(target.x + 1, target.y);

    const aliveBefore = scene.monsters.length;

    // Swing; auto-attack sustains the fight afterwards.
    await p.attack(target);

    const won = await p.waitFor(async () => {
      const s = await p.state();
      if (s.lifecycle !== 'alive') {
        return 'died';
      }
      if (s.monsters.length < aliveBefore) {
        return 'killed';
      }
      // keep swinging in case the target shuffled out of the arc
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
    }, { timeoutMs: 30000, intervalMs: 400, label: 'a monster kill' });

    assert(won === 'killed', 'killed a pack member within 30s (healer race is winnable)');

    const after = await p.state();
    assert(after.lifecycle === 'alive', `survived the pack (hp ${after.hp.current}/${after.hp.max})`);
    // dev:state can observe the scene removal one WebSocket tick before the
    // combat:hit broadcast reaches the harness. Wait for that real protocol
    // event instead of turning delivery order into a flaky assertion.
    await p.waitFor(() => p.hits.some(hit => hit.died), {
      timeoutMs: 2000,
      intervalMs: 25,
      label: 'combat kill event',
    });
    assert(p.hits.some(hit => hit.died), 'combat log recorded the kill');
  } finally {
    p.close();
  }
}
