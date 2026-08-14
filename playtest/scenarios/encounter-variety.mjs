/** Biomes change pack roles; aura pressure and rare modifiers remain killable. */
export default async function encounterVariety({ connect, assert }) {
  const p = await connect({
    guestId: 'playtest-encounter-variety',
    houseName: 'House Fieldwork',
    scionName: 'Iria Testborn',
  });
  try {
    await p.enterZone('crypt', 'warren');
    const crypt = await p.state();
    const count = (state, role) => state.monsters
      .filter(monster => monster.rarity !== 'elite' && monster.behaviour?.type === role).length;
    assert(count(crypt, 'melee') > count(crypt, 'ranged'), 'crypt packs lean toward close melee pressure');
    assert(count(crypt, 'buffer') > 0, 'crypt packs include aura buffers');

    await p.enterZone('marsh', 'clearings');
    let marsh = await p.state();
    assert(count(marsh, 'ranged') > count(crypt, 'ranged'), 'marsh packs add more ranged pressure than crypts');
    assert(count(marsh, 'buffer') > 0, 'marsh packs include aura buffers');
    const rare = marsh.monsters.find(monster => monster.rarity === 'rare');
    assert(rare?.modifiers?.length === 1, 'rare enemies expose one named combat modifier');

    const isEmpoweredTarget = monster => (
      monster.rarity === 'common'
      && ['melee', 'ranged'].includes(monster.behaviour?.type)
      && Object.values(monster.state?.effects || {}).some(effect => effect.label === 'Empowered')
    );
    marsh = await p.waitFor(async () => {
      const state = await p.state();
      return state.monsters.some(isEmpoweredTarget) ? state : false;
    }, { timeoutMs: 8000, label: 'live aura application' });
    assert(true, 'a nearby ally receives the buffer damage aura');

    p.devSetLevel(10);
    p.devHeal();
    const target = marsh.monsters.find(isEmpoweredTarget);
    p.devTeleport(Math.round(target.x), Math.round(target.y) + 1);
    await p.waitFor(async () => {
      const state = await p.state();
      return Math.abs(state.x - target.x) + Math.abs(state.y - target.y) <= 2;
    }, { label: 'aura-pack engagement position' });
    const startedAt = Date.now();
    await p.attack(target);
    await p.waitFor(async () => !(await p.state()).monsters.some(monster => monster.uuid === target.uuid), {
      timeoutMs: 15000,
      label: 'aura-empowered monster kill',
    });
    assert(Date.now() - startedAt < 15000, 'an aura-empowered pack member dies within the 15s TTK bound');
  } finally {
    p.close();
  }
}
