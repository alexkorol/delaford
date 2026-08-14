/** Public-path promise: a fresh guest URL reaches a populated fight in under ten seconds. */
export default async function quickstart({ connect, assert }) {
  const startedAt = Date.now();
  const player = await connect({
    guestId: `quickstart-${Date.now()}`,
    quickGuest: true,
  });
  try {
    await player.waitFor(async () => {
      const state = await player.state();
      return state.sceneType === 'instance' && state.monsters.length > 0;
    }, { timeoutMs: 9000, label: 'fresh guest fighting path' });
    const elapsed = Date.now() - startedAt;
    assert(elapsed < 10000, `fresh guest reached combat in ${(elapsed / 1000).toFixed(2)}s`);
  } finally {
    player.close();
  }
}
