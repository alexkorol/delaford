/**
 * Soft death: one lethal transition, a safe instance-entry respawn, and a
 * short ward that prevents the surrounding pack from immediately corpse-
 * camping the player. Using a skill deliberately ends the ward.
 */
export default async function respawn({ connect, assert }) {
  const p = await connect();
  try {
    await p.enterZone('grove', 'clearings');
    p.devKill({ allowCheatDeath: false });

    const dead = await p.waitFor(async () => {
      const state = await p.state();
      return state.lifecycle === 'awaiting-respawn' ? state : false;
    }, { label: 'soft death' });
    const deaths = dead.lifecycleDetails.deaths;
    const readyAt = dead.lifecycleDetails.respawn.at;
    assert(deaths > 0, 'soft death records one lifecycle transition');

    p.devKill({ allowCheatDeath: false });
    await new Promise(resolve => { setTimeout(resolve, 500); });
    const stillDead = await p.state();
    assert(stillDead.lifecycleDetails.deaths === deaths,
      'further lethal hits do not count duplicate deaths');
    assert(stillDead.lifecycleDetails.respawn.at === readyAt,
      'further lethal hits do not delay the pending respawn');

    const revived = await p.waitFor(async () => {
      const state = await p.state();
      return state.lifecycle === 'alive' && state.combat.respawnProtectionUntil > Date.now()
        ? state
        : false;
    }, { timeoutMs: 15000, intervalMs: 200, label: 'protected soft respawn' });
    const spawn = revived.sceneMetadata.spawnPoints[0];
    assert(revived.x === spawn.x && revived.y === spawn.y,
      'soft respawn returns to the instance entry');

    const target = revived.monsters
      .sort((a, b) => (Math.abs(a.x - revived.x) + Math.abs(a.y - revived.y))
        - (Math.abs(b.x - revived.x) + Math.abs(b.y - revived.y)))[0];
    assert(target, 'a monster is available to test the respawn ward');
    p.devTeleport(Math.round(target.x) + 1, Math.round(target.y));
    const protectedState = await p.state();
    const protectedHp = protectedState.hp.current;
    await new Promise(resolve => { setTimeout(resolve, 1800); });
    const afterPressure = await p.state();
    assert(afterPressure.hp.current >= protectedHp,
      `the respawn ward prevents immediate pack damage (${protectedHp} -> ${afterPressure.hp.current})`);

    p.useSkill('primary-attack', 'left');
    const acted = await p.waitFor(async () => {
      const state = await p.state();
      return state.combat.respawnProtectionUntil === 0 ? state : false;
    }, { label: 'respawn ward consumed by action' });
    assert(acted.lifecycle === 'alive', 'using a skill ends the ward without changing lifecycle');
  } finally {
    p.close();
  }
}
