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
  let shieldIdentity;
  let disconnectedPartyId;
  const identityOf = item => JSON.stringify({
    uuid: item.uuid,
    name: item.name,
    displayName: item.displayName,
    boundTo: item.boundTo,
    affixes: item.affixes,
    vessel: item.vessel,
    stats: item.stats,
    attributes: item.attributes,
    resourceBonuses: item.resourceBonuses,
    combatBonuses: item.combatBonuses,
  });
  try {
    first.devGive('vessel-ring', 1);
    // Seed 1670 at ilvl 40 deterministically rolls 22% Keen Eye and 13%
    // Beastbane Brands. The production factory still owns the item; the dev
    // seed only makes this real-protocol assertion reproducible.
    first.devGive('vessel-khopesh', 1, { seed: 1670, itemLevel: 40 });
    first.devGive('vessel-shield', 1);
    first.devSetLevel(4);
    const generated = await first.waitFor(async () => {
      const s = await first.state();
      const ring = s.inventoryDetails.find(item => item.id === 'vessel-ring');
      const sword = s.inventoryDetails.find(item => (
        item.id === 'vessel-khopesh'
        && item.combatBonuses?.criticalChance === 22
        && item.combatBonuses?.damageAgainstBeasts === 13
      ));
      const shield = s.inventoryDetails.find(item => (
        item.id === 'vessel-shield'
        && item.combatBonuses?.blockChance === 4
      ));
      return s.level === 4 && ring && sword && shield ? {
        s, ring, sword, shield,
      } : false;
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
    assert(equipped.combat.criticalChance === 22,
      'equipped Keen Eye Brand contributes its live 22% critical chance');
    assert(equipped.combat.damageAgainstBeasts === 13,
      'equipped Beastbane Brand contributes its live 13% beast damage');
    assert(equipped.wearDetails.right_hand.vessel.lines.some(line => (
      line.section === 'brand' && /Critical Chance/.test(line.text)
    )), 'Keen Eye tooltip presents critical chance as a live Brand');
    swordIdentity = identityOf(equipped.wearDetails.right_hand);
    first.equipItem(generated.shield, 'left_hand');
    const shieldEquipped = await first.waitFor(async () => {
      const s = await first.state();
      return s.wearDetails.left_hand?.uuid === generated.shield.uuid ? s : false;
    }, { label: 'generated shield equipped' });
    assert(shieldEquipped.combat.blockChance === 4,
      'equipped Vessel shield contributes its live 4% block chance');
    assert(shieldEquipped.wearDetails.left_hand.vessel.lines.some(line => (
      line.section === 'implicit' && /Chance to Block/.test(line.text)
    )), 'shield tooltip presents block as a live implicit');
    shieldIdentity = identityOf(shieldEquipped.wearDetails.left_hand);

    first.emit('party:create', {});
    const createdParty = await first.waitFor(() => (
      first.partyUpdateCount > 0 && first.party ? first.party : false
    ), { label: 'party created before disconnect' });
    disconnectedPartyId = createdParty.id;
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
    assert(identityOf(s.wearDetails.left_hand) === shieldIdentity,
      'equipped shield identity survived the relogin exactly');
    assert(s.combat.attack.slash > 0, 'derived Vesselforge combat stats were restored on login');
    assert(s.combat.blockChance === 4, 'Vesselforge block chance was restored on login');
    assert(s.combat.criticalChance === 22, 'Keen Eye critical chance was restored on login');
    assert(s.combat.damageAgainstBeasts === 13, 'Beastbane damage was restored on login');

    // A stale one-member party used to survive disconnect when the guest
    // account logout call threw. A fresh create after relog must produce a
    // different party, proving the old membership was removed.
    second.emit('party:create', {});
    const freshParty = await second.waitFor(() => (
      second.partyUpdateCount > 0 && second.party ? second.party : false
    ), { label: 'fresh party created after reconnect' });
    assert(freshParty.id !== disconnectedPartyId,
      'disconnect removed the previous party membership before relogin');
  } finally {
    second.close();
  }
}
