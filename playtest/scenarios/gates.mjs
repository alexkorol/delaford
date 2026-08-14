/**
 * Continuity: the ways out of the Crossroads are PHYSICAL gates in the
 * world. Each of the four road gates opens that road's Wayfinder's Chart
 * (travel happens from the chart — see world-web.mjs for the full loop).
 */
// The road gates sit one tile beside the village's own wilderness portals
// (see createTownScene in server/core/world-layout.js).
const ROAD_GATES = [
  { x: 37, y: 94, roadId: 'tin' },
  { x: 64, y: 114, roadId: 'salt' },
  { x: 37, y: 138, roadId: 'chalk' },
  { x: 12, y: 115, roadId: 'copper' },
];

export default async function gates({ connect, assert }) {
  const p = await connect({
    guestId: `playtest-gates-${Date.now()}`,
    houseName: 'House Gateward',
    scionName: 'Gate Testborn',
  });
  try {
    for (const gate of ROAD_GATES) {
      const screensBefore = p.screens.length;
      // Teleporting ONTO the gate tile triggers the portal, like stepping on it.
      p.devTeleport(gate.x, gate.y);
      const chart = await p.waitFor(() => {
        const opened = p.screens.slice(screensBefore).find(screen => screen.screen === 'chart');
        return opened ? opened.payload : false;
      }, { timeoutMs: 8000, label: `road gate ${gate.roadId}` });

      assert(chart.roadId === gate.roadId, `${gate.roadId}: gate opens its own chart`);
      assert(chart.nodes.length >= 1, `${gate.roadId}: the chart has a first stage`);
      assert(chart.nodes.find(node => node.tier === 1)?.status === 'open',
        `${gate.roadId}: tier 1 is charted from the start`);

      const home = await p.state();
      assert(home.sceneType === 'town', `${gate.roadId}: reading the chart does not move you`);

      // Step off the gate so the next teleport re-triggers cleanly.
      p.devTeleport(42, 115);
      await p.waitFor(async () => (await p.state()).x === 42, { label: 'return to the plaza' });
    }
  } finally {
    p.close();
  }
}
