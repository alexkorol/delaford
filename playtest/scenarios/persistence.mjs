/**
 * Core loop: KEEP YOUR STUFF. Playtest feedback: "doesn't seem like my loot
 * or char gets saved when I relogin". Grant an item and a level, disconnect
 * (which force-flushes the guest save file), relog, and both must be there.
 */
export default async function persistence({ connect, assert }) {
  const first = await connect();
  let levelBefore;
  let ringIdentity;
  let swordIdentity;
  const identityOf = item => JSON.stringify({
    uuid: item.uuid,
    name: item.name,
    displayName: item.displayName,
    boundTo: item.boundTo,
    affixes: item.affixes,
    vessel: item.vessel,
    stats: item.stats,
    attributes: item.attributes,
  });
  try {
    first.devGive('vessel-ring', 1);
    first.devGive('vessel-khopesh', 1);
    first.devSetLevel(4);
    const generated = await first.waitFor(async () => {
      const s = await first.state();
      const ring = s.inventoryDetails.find(item => item.id === 'vessel-ring');
      const sword = s.inventoryDetails.find(item => item.id === 'vessel-khopesh');
      return s.level === 4 && ring && sword ? { s, ring, sword } : false;
    }, { label: 'item granted + level set' });
    assert(generated.ring.vessel && generated.ring.affixes,
      'generated inventory gear carries vessel and affix identity');
    ringIdentity = identityOf(generated.ring);

    first.equipItem(generated.sword, 'right_hand');
    const equipped = await first.waitFor(async () => {
      const s = await first.state();
      return s.wearDetails.right_hand?.uuid === generated.sword.uuid ? s : false;
    }, { label: 'generated sword equipped' });
    assert(equipped.combat.attack.slash > 0,
      'equipped Vesselforge weapon contributes its derived combat rating');
    swordIdentity = identityOf(equipped.wearDetails.right_hand);
    levelBefore = 4;
  } finally {
    first.close(); // disconnect triggers a forced save
  }

  await new Promise(resolve => { setTimeout(resolve, 900); });

  const second = await connect();
  try {
    const s = await second.state();
    assert(s.level === levelBefore, `level survived the relogin (${s.level})`);
    assert(s.inventory.some(item => item.id === 'vessel-ring'), 'granted item survived the relogin');
    const ring = s.inventoryDetails.find(item => item.id === 'vessel-ring');
    assert(identityOf(ring) === ringIdentity, 'inventory affixes and vessel survived the relogin exactly');
    assert(identityOf(s.wearDetails.right_hand) === swordIdentity,
      'equipped item identity survived the relogin exactly');
    assert(s.combat.attack.slash > 0, 'derived Vesselforge combat stats were restored on login');
  } finally {
    second.close();
  }
}
