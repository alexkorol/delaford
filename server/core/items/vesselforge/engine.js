/* =============================================================================
   VESSELFORGE — modular ARPG item-system engine (ported from WIZARD)
   -----------------------------------------------------------------------------
   Zero dependencies. All game content lives in a pack (see verdigris-pack.js);
   the engine is only rules. Items are plain JSON. RNG is seedable for
   reproducible tests.

   Power model: every item is a VESSEL with N slots. Slots hold power with
   provenance — Brands ✦ (crafted), Bonds ◈ (lived), Trophies ✧ (hunted) —
   or are Scars ✕ (lost). Crafting spends the vessel's finite Patience.
   ============================================================================= */

/* ---------------- RNG (mulberry32, seedable) ---------------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fmt = (tpl, v) => String(tpl).replace(/\{v\}/g, v);
const ROMAN = ['I', 'II', 'III'];

/* ---------------- Pack validation ---------------- */
export function validatePack(pack) {
  const issues = [];
  const need = (cond, msg) => { if (!cond) issues.push(msg); };
  need(pack && pack.id, 'pack.id missing');
  ['materials', 'forms', 'brandMods', 'themes', 'archetypes', 'settings'].forEach(k =>
    need(pack[k], `pack.${k} missing`));
  if (issues.length) return issues;

  Object.entries(pack.forms).forEach(([id, f]) => {
    need(f.kind && f.w > 0 && f.h > 0, `form ${id}: kind/w/h invalid`);
    (f.materials || []).forEach(m => need(pack.materials[m], `form ${id}: unknown material ${m}`));
    if (f.implicit) need(f.implicit.label, `form ${id}: implicit needs label`);
  });
  Object.entries(pack.materials).forEach(([id, m]) => {
    need(m.tier >= 1, `material ${id}: tier missing`);
    if (m.ascendsTo) need(pack.materials[m.ascendsTo], `material ${id}: unknown ascendsTo ${m.ascendsTo}`);
  });
  Object.entries(pack.brandMods).forEach(([id, mod]) => {
    need(Array.isArray(mod.tiers) && mod.tiers.length, `brandMod ${id}: tiers missing`);
    need(Array.isArray(mod.kinds) && mod.kinds.length, `brandMod ${id}: kinds missing`);
    need(mod.label, `brandMod ${id}: label missing`);
  });
  Object.entries(pack.archetypes).forEach(([id, a]) =>
    need(pack.themes[a.themeId], `archetype ${id}: unknown theme ${a.themeId}`));
  Object.entries(pack.themes).forEach(([id, t]) => {
    need(t.mods && Object.keys(t.mods).length, `theme ${id}: no mods`);
    Object.entries(t.mods).forEach(([mid, m]) =>
      need(m.name && m.label && Array.isArray(m.roll), `theme ${id}.${mid}: name/label/roll required`));
  });
  Object.entries(pack.trophies || {}).forEach(([id, t]) => {
    need(t.fragments >= 1, `trophy ${id}: fragments count missing`);
    need(Array.isArray(t.mods) && t.mods.length, `trophy ${id}: mods missing`);
  });
  Object.entries(pack.pigments || {}).forEach(([id, p]) =>
    need(p.weights && Object.keys(p.weights).length, `pigment ${id}: weights missing`));
  Object.entries(pack.omens || {}).forEach(([id, o]) =>
    need(o.tag, `omen ${id}: tag missing`));
  return issues;
}

/* ---------------- Forge factory ---------------- */
export function createForge(pack, opts = {}) {
  const issues = validatePack(pack);
  if (issues.length) throw new Error(`invalid pack: ${issues.join('; ')}`);

  const S = Object.assign({
    maxVessel: 6,
    tierMults: [1, 1.6, 2.2],
    brandTierWeights: [10, 5, 2], // weight of tier index 0/1/2 when gated in
    attuneBase: 80,
    attuneStep: 55,
    estrangedFactor: 0.5,
    fireOutcomes: { ascend: 40, scar: 30, silent: 20, shatter: 10 },
    brandCountWeights: [30, 25, 25, 15, 5], // 0..4 brands at drop
    sellBase: 25,
  }, pack.settings);

  let rand = mulberry32(opts.seed != null ? opts.seed : (Math.random() * 2 ** 32) | 0);
  const rnd = () => rand();
  const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const pickWeighted = (entries) => { // entries: [{w, ...}]
    const total = entries.reduce((s, e) => s + e.w, 0);
    if (total <= 0) return null;
    let roll = rnd() * total;
    for (const e of entries) { roll -= e.w; if (roll <= 0) return e; }
    return entries[entries.length - 1];
  };
  let idCounter = 0;
  const genId = () => {
    idCounter += 1;
    return `vf${idCounter.toString(36)}${Math.floor(rnd() * 1e6).toString(36)}`;
  };

  /* ---------------- basic queries ---------------- */
  const material = item => pack.materials[item.materialId];
  const form = item => pack.forms[item.formId];
  const usedSlots = item => item.brands.length + item.bonds.length + item.trophies.length + item.scars;
  const freeSlots = item => item.vessel - usedSlots(item);
  const brandMod = b => pack.brandMods[b.modId];
  const bondMod = b => pack.themes[b.themeId].mods[b.modId];
  const bondValue = (bond, estranged) => {
    let v = bond.base * S.tierMults[bond.tier - 1];
    if (estranged) v *= S.estrangedFactor;
    return v < 4 ? Math.round(v * 10) / 10 : Math.round(v);
  };
  const isEstranged = (bond, archetype) => Boolean(bond.kinship) && bond.kinship !== archetype;
  const displayName = item => (item.awakened ? item.awakened.name
    : (item.epithetName || `${material(item).name} ${form(item).name}`));
  const dominantBondTheme = (item) => {
    if (!item.bonds.length) return null;
    const counts = {};
    item.bonds.forEach((b) => { counts[b.themeId] = (counts[b.themeId] || 0) + b.tier; });
    return Object.keys(pack.themes).sort((a, b) => (counts[b] || 0) - (counts[a] || 0))[0];
  };

  /* ---------------- item generation ---------------- */
  function materialPoolFor(formDef, ilvl) {
    const maxTier = 1 + Math.floor(ilvl / 15); // t2 @15, t3 @30, t4 @45, t5 @60, t6 @75
    return (formDef.materials || Object.keys(pack.materials))
      .map(id => ({ id, m: pack.materials[id] }))
      .filter(e => e.m.tier <= maxTier)
      .map(e => ({ w: e.m.dropWeight || 10, id: e.id }));
  }

  function rollBrand(item, o) {
    const entry = pickWeighted(brandPool(item, o));
    if (!entry) return null;
    const gated = entry.m.tiers
      .map((t, i) => ({ t, i }))
      .filter(e => (e.t.minIlvl || 0) <= item.ilvl);
    if (!gated.length) return null;
    const tierPick = pickWeighted(gated.map(e => ({ w: S.brandTierWeights[e.i] || 1, e })));
    const tierDef = tierPick.e.t;
    return {
      id: genId(),
      modId: entry.id,
      tier: tierPick.e.i + 1,
      value: rint(tierDef.roll[0], tierDef.roll[1]),
    };
  }

  function maybeName(item) {
    const nt = pack.nameTables;
    if (nt && !item.epithetName && item.brands.length + item.bonds.length + item.trophies.length >= 3) {
      item.epithetName = `${pick(nt.pre)} ${pick(nt.post)}`;
    }
  }

  function generateItem(genOpts = {}) {
    const ilvl = genOpts.ilvl != null ? genOpts.ilvl : rint(1, 80);
    let formId = genOpts.formId;
    if (!formId) {
      // random drops only pick forms with a legal material at this ilvl
      const legal = Object.keys(pack.forms).filter(f =>
        !pack.forms[f].noDrop && materialPoolFor(pack.forms[f], ilvl).length);
      formId = pick(legal.length ? legal : Object.keys(pack.forms));
    }
    const formDef = pack.forms[formId];
    let materialId = genOpts.materialId;
    if (!materialId) {
      const poolEntry = pickWeighted(materialPoolFor(formDef, ilvl));
      materialId = poolEntry ? poolEntry.id : (formDef.materials || Object.keys(pack.materials))[0];
    }
    const mat = pack.materials[materialId];
    const item = {
      v: 1,
      id: genId(),
      formId,
      materialId,
      kind: formDef.kind,
      w: formDef.w,
      h: formDef.h,
      ilvl,
      vessel: Math.min(S.maxVessel, rint(mat.vessel[0], mat.vessel[1])),
      scars: 0,
      patienceMax: rint(mat.patience[0], mat.patience[1]),
      patience: 0, // set below
      brands: [],
      bonds: [],
      trophies: [],
      att: { xp: 0, next: S.attuneBase, tc: {} },
      evolutions: 0,
      fired: 0,
      epithetName: null,
      awakened: null,
    };
    item.patience = item.patienceMax;
    if (!formDef.noVessel) {
      let n = genOpts.brands != null ? genOpts.brands
        : pickWeighted(S.brandCountWeights.map((w, i) => ({ w, n: i }))).n;
      n = Math.min(n, item.vessel);
      for (let i = 0; i < n; i += 1) {
        const rolled = rollBrand(item, {});
        if (rolled) item.brands.push(rolled);
      }
    } else {
      item.vessel = 0; item.patience = 0; item.patienceMax = 0;
    }
    maybeName(item);
    return item;
  }

  /* ---------------- brands ---------------- */
  function brandPool(item, o = {}) {
    const used = new Set([...item.brands.map(b => b.modId)]);
    const mat = material(item);
    const f = form(item);
    let pool = Object.entries(pack.brandMods)
      .filter(([id, m]) => m.kinds.includes(item.kind) && !used.has(id));
    if (o.omenId) {
      const tag = pack.omens[o.omenId].tag;
      pool = pool.filter(([, m]) => (m.tags || []).includes(tag));
    }
    return pool.map(([id, m]) => {
      let w = m.weight || 10;
      (m.tags || []).forEach((tag) => {
        if (mat.weights && mat.weights[tag]) w *= mat.weights[tag];
        if (f.weights && f.weights[tag]) w *= f.weights[tag];
        if (o.pigmentId && pack.pigments[o.pigmentId].weights[tag]) {
          w *= pack.pigments[o.pigmentId].weights[tag];
        }
      });
      return { id, m, w };
    }).filter(e => e.w > 0);
  }

  function explainOdds(item, o = {}) {
    const pool = brandPool(item, o);
    const total = pool.reduce((s, e) => s + e.w, 0);
    return pool
      .map(e => ({ modId: e.id, label: fmt(e.m.label, '#'), p: total ? e.w / total : 0 }))
      .sort((a, b) => b.p - a.p);
  }

  const spendPatience = (item, cost) => {
    if (item.patience < cost) return false;
    item.patience -= cost;
    return true;
  };
  const clone = item => JSON.parse(JSON.stringify(item));
  const err = error => ({ error });

  function sear(srcItem, o = {}) {
    const item = clone(srcItem);
    if (!item.vessel) return err('This holds no vessel');
    if (freeSlots(item) <= 0) return err('No free vessel slot');
    if (!spendPatience(item, 1)) return err('The vessel has no patience left for tools');
    if (o.omenId && !pack.omens[o.omenId]) return err('Unknown omen');
    if (o.pigmentId && !pack.pigments[o.pigmentId]) return err('Unknown pigment');
    const brand = rollBrand(item, o);
    if (!brand) return err(o.omenId ? 'The omen shows nothing this vessel can hold' : 'No brand will take');
    item.brands.push(brand);
    maybeName(item);
    return { item, event: { kind: 'craft', text: `Seared: ${fmt(brandMod(brand).label, brand.value)} (T${brand.tier})` } };
  }

  function efface(srcItem) {
    const item = clone(srcItem);
    if (!item.brands.length) return err('No brand to efface');
    if (!spendPatience(item, 1)) return err('The vessel has no patience left for tools');
    const removed = item.brands.pop();
    return { item, event: { kind: 'craft', text: `Effaced: ${fmt(brandMod(removed).label, removed.value)}` } };
  }

  function chisel(srcItem) {
    const item = clone(srcItem);
    if (!item.vessel) return err('This holds no vessel');
    if (item.vessel >= S.maxVessel) return err('The vessel can hold no more');
    if (!spendPatience(item, 2)) return err('Carving needs 2 patience');
    item.vessel += 1;
    return { item, event: { kind: 'craft', text: `Carved a new vessel slot (${item.vessel}/${S.maxVessel})` } };
  }

  /* ---------------- firing (material ascension gamble) ---------------- */
  function fire(srcItem) {
    const item = clone(srcItem);
    if (!item.vessel) return err('This holds no vessel');
    const mat = material(item);
    if (!mat.ascendsTo) return err(`${mat.name} cannot be fired higher`);
    if (!spendPatience(item, 2)) return err('Firing needs 2 patience');
    const outcomes = Object.entries(S.fireOutcomes).map(([k, w]) => ({ w, k }));
    const res = pickWeighted(outcomes).k;
    if (res === 'ascend') {
      item.materialId = mat.ascendsTo;
      item.fired += 1;
      const nm = material(item);
      item.vessel = Math.min(S.maxVessel, Math.max(item.vessel, nm.vessel[0]));
      return { item, event: { kind: 'awake', text: `The kiln favors it — the ${mat.name} runs and sets as ${nm.name}.` } };
    }
    if (res === 'scar') {
      if (freeSlots(item) > 0) item.scars += 1;
      item.fired += 1;
      return { item, event: { kind: 'craft', text: 'The kiln bites — a slot is scarred.' } };
    }
    if (res === 'shatter') {
      return { destroyed: true, event: { kind: 'craft', text: `The kiln keeps it. The ${mat.name} ${form(item).name.toLowerCase()} shatters.` } };
    }
    item.fired += 1;
    return { item, event: { kind: 'sys', text: 'The kiln is silent. Nothing changes.' } };
  }

  /* ---------------- trophies ---------------- */
  function addFragment(stash, trophyId) {
    const t = pack.trophies[trophyId];
    if (!t) return err('Unknown trophy');
    const next = Object.assign({}, stash);
    next[trophyId] = (next[trophyId] || 0) + 1;
    const completed = next[trophyId] >= t.fragments;
    return { stash: next, completed, event: { kind: 'sys', text: completed ? `${t.name} complete (${t.fragments}/${t.fragments})!` : `${t.name} fragment (${next[trophyId]}/${t.fragments})` } };
  }

  function socketTrophy(srcItem, trophyId, stash) {
    const t = pack.trophies[trophyId];
    if (!t) return err('Unknown trophy');
    if ((stash[trophyId] || 0) < t.fragments) return err(`Needs ${t.fragments} fragments`);
    const item = clone(srcItem);
    if (!item.vessel) return err('This holds no vessel');
    if (!t.kinds.includes(item.kind)) return err(`A ${t.name} will not bind to this`);
    if (item.trophies.some(x => x.trophyId === trophyId)) return err('Already bears this trophy');
    if (freeSlots(item) <= 0) return err('No free vessel slot');
    item.trophies.push({ id: genId(), trophyId });
    const nextStash = Object.assign({}, stash);
    nextStash[trophyId] -= t.fragments;
    return { item, stash: nextStash, event: { kind: 'craft', text: `Bound trophy: ${t.name}` } };
  }

  function pryTrophy(srcItem) {
    const item = clone(srcItem);
    if (!item.trophies.length) return err('No trophy to pry out');
    const removed = item.trophies.pop();
    return { item, event: { kind: 'craft', text: `Pried out ${pack.trophies[removed.trophyId].name} — it crumbles.` } };
  }

  /* ---------------- bonds ---------------- */
  function rollBond(item, kinship) {
    const used = new Set(item.bonds.map(b => b.modId));
    const order = Object.keys(pack.themes)
      .filter(t => (item.att.tc[t] || 0) > 0)
      .sort((a, b) => (item.att.tc[b] || 0) - (item.att.tc[a] || 0));
    const searchOrder = [...(order.length ? order : [pick(Object.keys(pack.themes))]),
      ...Object.keys(pack.themes)];
    for (const themeId of searchOrder) {
      const pool = Object.entries(pack.themes[themeId].mods).filter(([id]) => !used.has(id));
      if (pool.length) {
        const [modId, m] = pick(pool);
        return { id: genId(), modId, themeId, base: rint(m.roll[0], m.roll[1]), tier: 1, kinship };
      }
    }
    return null;
  }

  function awaken(item, charName) {
    const themeId = dominantBondTheme(item) || pick(Object.keys(pack.themes));
    const t = pack.themes[themeId];
    item.awakened = {
      name: `${charName}'s ${pick(t.adjs)} ${pick(t.epithets)}`,
      themeId,
      power: t.power,
      flavor: `Bound to ${charName} through ${item.evolutions} trials. ${t.memory}`,
    };
  }

  const isSated = (item) => {
    if (!item.vessel) return true;
    if (freeSlots(item) > 0) return false;
    if (item.bonds.some(b => b.tier < 3)) return false;
    if (!item.awakened && item.bonds.length >= 3) return false;
    return true;
  };

  function evolve(item, ctx) {
    if (freeSlots(item) > 0) {
      const bond = rollBond(item, ctx.archetype);
      if (bond) {
        item.bonds.push(bond);
        item.evolutions += 1;
        maybeName(item);
        const m = bondMod(bond);
        return { kind: 'bond', text: `Bond formed on ${displayName(item)}: ${m.name} — ${fmt(m.label, bondValue(bond, false))}` };
      }
    }
    const weakest = item.bonds.filter(b => b.tier < 3).sort((a, b) => a.tier - b.tier)[0];
    if (weakest) {
      weakest.tier += 1;
      item.evolutions += 1;
      return { kind: 'bond', text: `Bond deepened on ${displayName(item)}: ${bondMod(weakest).name} → ${ROMAN[weakest.tier - 1]}` };
    }
    if (!item.awakened && item.bonds.length >= 3 && item.bonds.every(b => b.tier === 3)) {
      awaken(item, ctx.charName);
      item.evolutions += 1;
      return { kind: 'awake', text: `${displayName(item)} has AWAKENED as "${item.awakened.name}"` };
    }
    return null;
  }

  function attune(srcItem, xp, themeWeights, ctx) {
    const item = clone(srcItem);
    const events = [];
    if (isSated(item)) return { item, events };
    Object.entries(themeWeights || {}).forEach(([t, w]) => {
      item.att.tc[t] = (item.att.tc[t] || 0) + w;
    });
    item.att.xp += xp;
    let guard = 0;
    while (item.att.xp >= item.att.next && guard < 8) {
      guard += 1;
      item.att.xp -= item.att.next;
      const ev = evolve(item, ctx);
      if (ev) events.push(ev);
      item.att.next = S.attuneBase + S.attuneStep * item.evolutions;
      if (isSated(item)) { item.att.xp = 0; break; }
    }
    return { item, events };
  }

  function resonate(srcItem) {
    const item = clone(srcItem);
    const weakest = item.bonds.filter(b => b.tier < 3).sort((a, b) => a.tier - b.tier)[0];
    if (!weakest) return err(item.bonds.length ? 'All bonds are at tier III' : 'No bond to deepen');
    weakest.tier += 1;
    item.evolutions += 1;
    return { item, event: { kind: 'bond', text: `Resonance: ${bondMod(weakest).name} → ${ROMAN[weakest.tier - 1]}` } };
  }

  function sever(srcItem) {
    const item = clone(srcItem);
    if (!item.bonds.length) return err('No bond to sever');
    const weakest = [...item.bonds].sort((a, b) => a.tier - b.tier)[0];
    item.bonds = item.bonds.filter(b => b.id !== weakest.id);
    item.scars += 1;
    return { item, event: { kind: 'craft', text: `Severed ${bondMod(weakest).name}. The slot is scarred.` } };
  }

  /* ---------------- character & ventures ---------------- */
  function createCharacter(o = {}) {
    return {
      v: 1,
      name: o.name || 'Nameless',
      archetype: o.archetype || Object.keys(pack.archetypes)[0],
      xp: 0,
      gold: o.gold || 0,
      deeds: {},
      fragments: {},
    };
  }
  const charLevel = c => 1 + Math.floor(c.xp / 100);

  function venture(character, equipment) {
    const c = JSON.parse(JSON.stringify(character));
    const enc = pick(pack.encounters || [{ text: 'wandered the hills', themes: {} }]);
    const events = [];
    const gold = rint(20, 65);
    c.gold += gold;
    c.xp += rint(25, 45);
    const themes = Object.assign({}, enc.themes);
    const archTheme = pack.archetypes[c.archetype].themeId;
    themes[archTheme] = (themes[archTheme] || 0) + 1;
    Object.entries(themes).forEach(([t, w]) => { c.deeds[t] = (c.deeds[t] || 0) + w; });
    events.push({ kind: 'deed', text: `${c.name} ${enc.text}. (+${gold}g)` });

    const eq = {};
    const ctx = { charName: c.name, archetype: c.archetype };
    Object.entries(equipment).forEach(([slot, it]) => {
      if (!it || !it.vessel || isSated(it)) { eq[slot] = it; return; }
      const res = attune(it, rint(16, 30), themes, ctx);
      eq[slot] = res.item;
      events.push(...res.events);
    });

    const drops = [];
    if (rnd() < 0.4) {
      drops.push(generateItem({ ilvl: Math.min(80, 10 + charLevel(c) * 3 + rint(0, 15)) }));
    }
    const fragments = [];
    if (pack.trophies && rnd() < (enc.trophyChance != null ? enc.trophyChance : 0.35)) {
      const tid = enc.trophy || pick(Object.keys(pack.trophies));
      const res = addFragment(c.fragments, tid);
      c.fragments = res.stash;
      fragments.push(tid);
      events.push(res.event);
    }
    return { character: c, equipment: eq, drops, fragments, events, encounter: enc };
  }

  /* ---------------- aggregation ---------------- */
  function panoply(items) {
    const groups = {};
    items.filter(Boolean).forEach((it) => {
      if (!it.awakened) return;
      const kin = it.bonds[0] && it.bonds[0].kinship;
      if (!kin) return;
      groups[kin] = (groups[kin] || 0) + 1;
    });
    const out = [];
    Object.entries(groups).forEach(([kin, n]) => {
      const defs = pack.panoply || {};
      const best = Object.keys(defs).map(Number).filter(k => k <= n).sort((a, b) => b - a)[0];
      if (best) out.push({ kinship: kin, count: n, bonus: defs[best] });
    });
    return out;
  }

  function aggregate(items, ctx = {}) {
    const sums = {};
    const conditionals = [];
    const add = (id, v) => { if (id) sums[id] = (sums[id] || 0) + v; };
    items.filter(Boolean).forEach((item) => {
      const f = form(item);
      if (f.implicit && f.implicit.stat) add(f.implicit.stat.id, f.implicit.stat.v);
      item.brands.forEach((b) => {
        const m = brandMod(b);
        if (m.shape === 'flat' || m.shape === 'scalar') add(b.modId, b.value);
      });
      item.bonds.forEach((b) => {
        const m = bondMod(b);
        const est = isEstranged(b, ctx.archetype);
        conditionals.push({
          source: displayName(item),
          name: m.name,
          shape: m.shape || 'conditional',
          text: fmt(m.label, bondValue(b, est)),
          themeId: b.themeId,
          tier: b.tier,
          estranged: est,
        });
      });
      item.trophies.forEach((tr) => {
        const t = pack.trophies[tr.trophyId];
        t.mods.forEach((m) => {
          if (m.shape === 'flat' || m.shape === 'scalar') add(m.stat, m.v);
          else conditionals.push({ source: t.name, name: t.name, shape: m.shape, text: fmt(m.label, m.v) });
        });
        if (t.completionBonus) {
          conditionals.push({ source: t.name, name: `${t.name} (complete)`, shape: t.completionBonus.shape || 'conditional', text: t.completionBonus.label });
        }
      });
      if (item.awakened) {
        conditionals.push({ source: displayName(item), name: 'Awakened', shape: 'trigger', text: item.awakened.power, themeId: item.awakened.themeId });
      }
    });
    const panoplies = panoply(items);
    const sheet = pack.derive ? pack.derive(sums, items.filter(Boolean), ctx) : sums;
    return { sums, sheet, conditionals, panoplies };
  }

  /* ---------------- presentation (UI-agnostic tooltip) ---------------- */
  function tooltip(item, ctx = {}) {
    const lines = [];
    const mat = material(item);
    const f = form(item);
    const push = (section, text, tone) => lines.push({ section, text, tone: tone || 'normal' });
    push('name', displayName(item), item.awakened ? 'awakened' : (item.bonds.length > item.brands.length ? 'bonded' : (item.brands.length ? 'branded' : 'plain')));
    if (item.epithetName || item.awakened) push('base', `${mat.name} ${f.name}`);
    push('kind', `${f.kindLabel || item.kind} · ${mat.name} (tier ${mat.tier}) · Item Level ${item.ilvl}`);
    if (item.vessel) {
      push('vessel', `Vessel ${item.vessel} · Patience ${item.patience}/${item.patienceMax}`);
    }
    if (f.weapon) push('stat', `Damage ${Math.round(f.weapon.dmg[0] * mat.statMult)}–${Math.round(f.weapon.dmg[1] * mat.statMult)} · Speed ${f.weapon.aps}`);
    if (f.armor) push('stat', `Armour ${Math.round(f.armor * mat.statMult)}`);
    if (f.implicit) push('implicit', f.implicit.label);
    item.brands.forEach(b => push('brand', `✦ ${fmt(brandMod(b).label, b.value)} (T${b.tier})`));
    item.bonds.forEach((b) => {
      const est = isEstranged(b, ctx.archetype);
      const m = bondMod(b);
      push('bond', `◈ ${m.name} — ${fmt(m.label, bondValue(b, est))} · ${pack.archetypes[b.kinship] ? pack.archetypes[b.kinship].name : ''} ${ROMAN[b.tier - 1]}${est ? ' · estranged' : ''}`, est ? 'estranged' : 'bond');
    });
    item.trophies.forEach((tr) => {
      const t = pack.trophies[tr.trophyId];
      push('trophy', `✧ ${t.name}`);
      t.mods.forEach(m => push('trophy', `   ${fmt(m.label, m.v)}`));
      if (t.completionBonus) push('trophy', `   ${t.completionBonus.label}`, 'bonus');
    });
    if (item.scars) push('scar', `✕ ${item.scars} scarred slot${item.scars > 1 ? 's' : ''}`);
    if (item.awakened) {
      push('power', item.awakened.power, 'awakened');
      push('flavor', item.awakened.flavor);
    }
    if (item.vessel && !isSated(item)) push('attune', `Attunement ${item.att.xp}/${item.att.next}`);
    return lines;
  }

  function sellValue(item) {
    if (!item.vessel) return 40;
    const mat = material(item);
    return S.sellBase * mat.tier
      + item.brands.length * 40
      + item.bonds.reduce((s, b) => s + b.tier * 25, 0)
      + item.trophies.length * 60
      + (item.awakened ? 400 : 0);
  }

  /* ---------------- serialization ---------------- */
  const serialize = state => JSON.stringify({ packId: pack.id, state });
  function deserialize(raw) {
    const data = JSON.parse(raw);
    if (data.packId !== pack.id) throw new Error(`save is for pack ${data.packId}, forge runs ${pack.id}`);
    return data.state;
  }

  return {
    pack,
    settings: S,
    reseed: (seed) => { rand = mulberry32(seed >>> 0); },
    // generation
    generateItem,
    materialPoolFor,
    // crafting
    sear,
    efface,
    chisel,
    fire,
    explainOdds,
    // bonds
    attune,
    resonate,
    sever,
    isSated,
    // trophies
    addFragment,
    socketTrophy,
    pryTrophy,
    // play loop
    createCharacter,
    charLevel,
    venture,
    // reading
    aggregate,
    panoply,
    tooltip,
    sellValue,
    displayName,
    dominantBondTheme,
    bondValue,
    isEstranged,
    freeSlots,
    // persistence
    serialize,
    deserialize,
  };
}

export default { createForge, validatePack, version: '1.0.0' };
