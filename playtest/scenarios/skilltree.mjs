/**
 * Core loop: SPEND POINTS. Save a skill-tree build, then relog and confirm
 * the server restores it on login. Regression: allocations used to vanish
 * the moment the pane closed.
 */
export default async function skilltree({ connect, assert }) {
  const snapshot = {
    nodes: ['0,0', '1,0'],
    conduits: [{ id: '0,0:1,0', variant: 'outer' }],
    points: { skill: 0 },
    earned: 2,
    selectedNodeId: '1,0',
  };

  const first = await connect();
  try {
    first.saveSkillTree(snapshot);
    await first.waitFor(async () => {
      const s = await first.state();
      return s.passiveTree && s.passiveTree.nodes.includes('1,0');
    }, { label: 'tree saved server-side' });
  } finally {
    first.close();
  }

  // Give the server a beat to process the disconnect, then relog.
  await new Promise(resolve => { setTimeout(resolve, 700); });

  const second = await connect();
  try {
    const restored = second.player.passiveTree;
    assert(restored, 'login block carries the saved tree');
    assert(restored.nodes.includes('1,0'), 'allocated node survived the relog');
    assert(restored.conduits.some(c => c.id === '0,0:1,0'), 'allocated conduit survived the relog');
    assert(restored.earned === 2, 'earned-points reconciliation data survived');
  } finally {
    second.close();
  }
}
