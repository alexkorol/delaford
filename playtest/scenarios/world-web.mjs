/**
 * World-web contract (docs/crossroads-world-web.md): a road gate opens the
 * Wayfinder's Chart, travel enters a private per-House zone, the onward gate
 * refuses while the Warden lives, the Warden's death unlocks the children,
 * and a cleared zone persists (dead stays dead) across re-entry.
 */
export default async function worldWeb({ connect, assert }) {
  const p = await connect({
    guestId: `playtest-world-web-${Date.now()}`,
    houseName: 'House Webward',
    scionName: 'Chart Testborn',
  });
  try {
    // 1. The north gate opens the Tin Road's chart.
    const screensBefore = p.screens.length;
    p.devTeleport(38, 94);
    await p.waitFor(() => p.screens.slice(screensBefore).some(screen => screen.screen === 'chart'), {
      timeoutMs: 8000,
      label: 'road gate opens the Wayfinder\'s Chart',
    });
    let chart = p.screens.filter(screen => screen.screen === 'chart').at(-1).payload;
    assert(chart.roadId === 'tin', 'the north gate reads the Tin Road');
    const root = chart.nodes.find(node => node.tier === 1);
    assert(root && root.status === 'open', `tier 1 is charted from the start (${root?.name})`);
    assert(chart.nodes.filter(node => node.tier === 2).length === 0,
      'deeper stages stay off the chart until the Warden falls');

    // 2. Travel to the root node: a private instance of the node.
    p.devSetLevel(30);
    p.devHeal();
    p.emit('world:zone:enter', { nodeId: root.id });
    const zone = await p.waitFor(async () => {
      const current = await p.state();
      return current.sceneType === 'instance' && current.sceneMetadata.nodeId === root.id
        ? current
        : false;
    }, { timeoutMs: 10000, label: 'travel into the tier-1 zone' });
    assert(zone.sceneName === root.name, `zone carries its charted name (${zone.sceneName})`);
    assert(zone.monsters.length >= 10, `the zone is populated (${zone.monsters.length})`);
    assert(zone.monsters.some(monster => monster.name === root.wardenName),
      `the ${root.wardenName} keeps the ground`);
    assert(zone.sceneMetadata.entryGate, 'the entry waymark is recorded');
    const gates = zone.sceneMetadata.zoneGates || [];
    assert(gates.length >= 1, 'an onward gate leads toward the next stage');

    // 3. No road holds past a living Warden.
    const gate = gates[0];
    const messagesBefore = p.messages.length;
    p.devTeleport(gate.x, gate.y);
    await p.waitFor(() => p.messages.slice(messagesBefore).some(message => (
      /No road holds past a living Warden/i.test(message)
    )), { timeoutMs: 6000, label: 'onward gate refuses while the Warden lives' });
    const held = await p.state();
    assert(held.sceneMetadata.nodeId === root.id, 'the gate held the player in place');

    // 4. Put the Warden down; the chartline runs a stage deeper.
    const spawn = zone.sceneMetadata.spawnPoints?.[0] || { x: gate.x, y: gate.y };
    p.devTeleport(spawn.x, spawn.y);
    await p.waitFor(async () => (await p.state()).x === spawn.x, { label: 'step off the gate' });
    p.devClearFloor();
    await p.waitFor(() => p.messages.some(message => (
      new RegExp(`Warden of .* is down`, 'i').test(message)
    )), { timeoutMs: 10000, label: 'Warden death announcement' });

    // 5. The onward gate now presses into the child zone.
    const transitionsBefore = p.sceneTransitions || 0;
    p.devTeleport(gate.x, gate.y);
    await p.waitFor(() => (p.sceneTransitions || 0) > transitionsBefore, {
      timeoutMs: 10000,
      label: 'onward gate into the next stage',
    });
    p.devHeal();
    const child = await p.state();
    assert(child.sceneMetadata.nodeId === gate.nodeId,
      `pressed on into ${gate.name} (${child.sceneMetadata.nodeId})`);
    assert(child.sceneMetadata.tier === 2, 'the child zone is one stage deeper');

    // 6. The chart records the cleared Warden and the open children.
    p.emit('world:road:chart', { roadId: 'tin' });
    chart = await p.waitFor(() => {
      const latest = p.screens.filter(screen => screen.screen === 'chart').at(-1).payload;
      return latest.nodes.some(node => node.id === root.id && node.status === 'cleared')
        ? latest
        : false;
    }, { timeoutMs: 6000, label: 'chart shows the root cleared' });
    assert(chart.nodes.filter(node => node.tier === 2).every(node => node.status !== 'barred'),
      'the next stage is open past the dead Warden');

    // 7. Walk back to the Crossroads through the entry waymark.
    const entry = child.sceneMetadata.entryGate;
    const backBefore = p.sceneTransitions || 0;
    p.devTeleport(entry.x, entry.y);
    await p.waitFor(() => (p.sceneTransitions || 0) > backBefore, {
      timeoutMs: 10000,
      label: 'entry waymark returns to the Crossroads',
    });
    const home = await p.state();
    assert(home.sceneType === 'town', 'back on truce-ground');

    // 8. Persistence: the cleared root zone lies still on re-entry.
    p.emit('world:zone:enter', { nodeId: root.id });
    const revisit = await p.waitFor(async () => {
      const current = await p.state();
      return current.sceneType === 'instance' && current.sceneMetadata.nodeId === root.id
        ? current
        : false;
    }, { timeoutMs: 10000, label: 're-enter the cleared zone' });
    assert(revisit.monsters.length === 0,
      `the cleared ground lies still — dead stays dead (${revisit.monsters.length} alive)`);
    assert(revisit.sceneMetadata.wardenDead === true, 'the Warden stays down inside the linger window');
  } finally {
    p.close();
  }
}
