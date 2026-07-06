/**
 * Continuity: instance zones have PHYSICAL gates in the world, not just a
 * menu (playtest feedback: "going into a random dungeon is through... a
 * drop down menu? where's the continuity?"). Step on a gate, arrive in the
 * generated zone.
 */
const GATES = [
  { sceneId: 'zone:old-wood', x: 96, y: 139, template: 'grove', layout: 'clearings' },
  { sceneId: 'zone:old-wood', x: 112, y: 142, template: 'dungeon', layout: 'warren' },
  { sceneId: 'zone:fenmire', x: 60, y: 116, template: 'marsh', layout: 'clearings' },
  { sceneId: 'zone:saint-aldrics-graveyard', x: 88, y: 44, template: 'crypt', layout: 'warren' },
];

export default async function gates({ connect, assert }) {
   
  for (const gate of GATES) {
    const p = await connect();
    try {
      const before = p.sceneTransitions || 0;
      // Teleporting ONTO the gate tile triggers the portal, like stepping on it.
      p.devTeleport(gate.x, gate.y, gate.sceneId);
      await p.waitFor(() => (p.sceneTransitions || 0) > before, {
        timeoutMs: 10000,
        label: `gate to ${gate.template}/${gate.layout}`,
      });
      const s = await p.state();
      assert(s.sceneType === 'instance', `${gate.template}: gate leads into an instance`);
      assert(s.sceneMetadata.layout === gate.layout, `${gate.template}: layout ${s.sceneMetadata.layout}`);
    } finally {
      p.close();
    }
    await new Promise(resolve => { setTimeout(resolve, 700); });
  }
   
}
