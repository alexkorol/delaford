/** Two ring seats and the waist (belt) slot equip through the real item pipeline. */
export default async function equipmentSlots({ connect, assert }) {
  const p = await connect({
    guestId: 'playtest-equipment-slots',
    houseName: 'House Buckle',
    scionName: 'Wren Testborn',
  });
  try {
    // A first ring takes the primary ring seat.
    p.devGive('ring', 1);
    const firstRing = await p.waitFor(async () => {
      const state = await p.state();
      const ring = state.inventory.find(entry => entry.id === 'ring');
      return ring || false;
    }, { label: 'first ring granted' });
    p.equipItem(firstRing);
    await p.waitFor(async () => {
      const state = await p.state();
      return state.wear.ring === 'ring';
    }, { label: 'first ring worn in the primary seat' });

    // A second, different ring fills the second seat instead of replacing the first.
    p.devGive('gold-ring', 1);
    const secondRing = await p.waitFor(async () => {
      const state = await p.state();
      const ring = state.inventory.find(entry => entry.id === 'gold-ring');
      return ring || false;
    }, { label: 'second ring granted' });
    p.equipItem(secondRing);
    const twoRings = await p.waitFor(async () => {
      const state = await p.state();
      return state.wear.ring2 === 'gold-ring' ? state : false;
    }, { label: 'second ring worn in the second seat' });
    assert(twoRings.wear.ring === 'ring', 'the first ring stays in the primary seat');
    assert(twoRings.wear.ring2 === 'gold-ring', 'a second ring fills the second seat');

    // The waist slot accepts a belt item.
    p.devGive('hide-girdle', 1);
    const belt = await p.waitFor(async () => {
      const state = await p.state();
      const found = state.inventory.find(entry => entry.id === 'hide-girdle');
      return found || false;
    }, { label: 'belt granted' });
    p.equipItem(belt);
    const withWaist = await p.waitFor(async () => {
      const state = await p.state();
      return state.wear.belt === 'hide-girdle' ? state : false;
    }, { label: 'belt worn in the waist seat' });
    assert(withWaist.wear.belt === 'hide-girdle', 'a belt equips into the waist slot');
    assert(
      withWaist.wear.ring === 'ring' && withWaist.wear.ring2 === 'gold-ring',
      'both ring seats survive equipping the belt',
    );
  } finally {
    p.close();
  }
}
