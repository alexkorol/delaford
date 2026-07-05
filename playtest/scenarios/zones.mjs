/**
 * Core loop: ZONES. Enter every Adventure-menu zone, confirm the right
 * layout/scene arrives, stairs exist, and the player is not bounced back.
 * Then return to town via the entry stairs and confirm the surface position
 * is restored (regression: players were stranded at dungeon coordinates).
 */
const MENU_ZONES = [
  ['dungeon', 'warren'],
  ['grove', 'clearings'],
  ['crypt', 'gauntlet'],
  ['crypt', 'warren'],
  ['wilds', 'clearings'],
  ['marsh', 'clearings'],
];

export default async function zones({ connect, assert }) {
  const p = await connect();
  try {
    const town = await p.state();

     
    for (const [template, layout] of MENU_ZONES) {
      const scene = await p.enterZone(template, layout);
      const s = await p.state();
      assert(s.sceneType === 'instance', `${template}/${layout}: entered an instance`);
      assert(s.sceneMetadata.layout === layout, `${template}/${layout}: layout applied (${s.sceneMetadata.layout})`);
      assert(s.sceneMetadata.stairsUp && s.sceneMetadata.stairsDown, `${template}/${layout}: both stairs exist`);
      assert(scene && scene.name && !scene.name.startsWith('instance'), `${template}/${layout}: scene has a display name (${scene.name})`);
      assert(s.monsters.length >= 15, `${template}/${layout}: populated (${s.monsters.length} monsters)`);
    }
     

    // Step onto the entry stairs -> back to town at the pre-entry position.
    const inInstance = await p.state();
    p.devTeleport(inInstance.sceneMetadata.stairsUp.x, inInstance.sceneMetadata.stairsUp.y);
    await p.waitFor(async () => (await p.state()).sceneType !== 'instance', {
      timeoutMs: 6000,
      label: 'return to town via stairs',
    });
    const back = await p.state();
    assert(back.x === town.x && back.y === town.y,
      `returned to the pre-entry position (${back.x},${back.y} vs ${town.x},${town.y})`);
  } finally {
    p.close();
  }
}
