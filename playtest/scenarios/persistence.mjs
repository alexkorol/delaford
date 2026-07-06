/**
 * Core loop: KEEP YOUR STUFF. Playtest feedback: "doesn't seem like my loot
 * or char gets saved when I relogin". Grant an item and a level, disconnect
 * (which force-flushes the guest save file), relog, and both must be there.
 */
export default async function persistence({ connect, assert }) {
  const first = await connect();
  let levelBefore;
  try {
    first.devGive('gold-ring', 1);
    first.devSetLevel(4);
    await first.waitFor(async () => {
      const s = await first.state();
      return s.level === 4 && s.inventory.some(item => item.id === 'gold-ring');
    }, { label: 'item granted + level set' });
    levelBefore = 4;
  } finally {
    first.close(); // disconnect triggers a forced save
  }

  await new Promise(resolve => { setTimeout(resolve, 900); });

  const second = await connect();
  try {
    const s = await second.state();
    assert(s.level === levelBefore, `level survived the relogin (${s.level})`);
    assert(s.inventory.some(item => item.id === 'gold-ring'), 'granted item survived the relogin');
  } finally {
    second.close();
  }
}
