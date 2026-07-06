/**
 * One character, one session. A second login (another tab, a playtest bot)
 * used to silently steal the player mid-play: the old client broke with
 * "foreign player reference" rejections and its unsaved loot vanished.
 * Now the old session is flushed to disk, told it was replaced, and closed
 * — and the new session loads the up-to-the-second state.
 */
export default async function singleSession({ connect, assert }) {
  const first = await connect();
  let second = null;
  try {
    first.devGive('garnet-amulet', 1);
    await first.waitFor(async () => {
      const s = await first.state();
      return s.inventory.some(item => item.id === 'garnet-amulet');
    }, { label: 'loot granted to first session' });

    // Second login for the same guest, while the first is still connected.
    second = await connect();

    await first.waitFor(() => first.sessionReplaced === true, {
      timeoutMs: 6000,
      label: 'old session notified of replacement',
    });
    await first.waitFor(() => first.closed === true, {
      timeoutMs: 6000,
      label: 'old session closed by the server',
    });

    // The unsaved loot from the first session must have crossed over.
    const s = await second.state();
    assert(s.inventory.some(item => item.id === 'garnet-amulet'),
      'loot from the replaced session survived the handoff');
    assert(!second.closed, 'new session stays connected');
  } finally {
    first.close();
    if (second) {
      second.close();
    }
  }
}
