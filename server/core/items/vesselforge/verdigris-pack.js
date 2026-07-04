/* =============================================================================
   VERDIGRIS CONTENT PACK for Vesselforge (ported from WIZARD)
   -----------------------------------------------------------------------------
   Bronze-age, low-power, low-fantasy. Copper is wealth, bronze is power,
   riveted mail is a rumor from beyond the horizon. Influences: early
   Mediterranean & Mesopotamian bronze age, Mesoamerica (macuahuitl,
   ichcahuipilli quilted armor, obsidian), paleolithic (flint, bone, hide,
   atlatl).

   Pure data + one optional derive() for the character sheet. Everything is
   serializable except label templates ("{v}" placeholders) and derive().
   ============================================================================= */

/* Tags: blade blunt reach hide ward life spirit ember river beast fortune swift blood */

const pack = {
  id: 'verdigris-1',
  name: 'Verdigris — the Green Lands',

  settings: {
    maxVessel: 6,
    tierMults: [1, 1.6, 2.2],
    fireOutcomes: { ascend: 40, scar: 30, silent: 20, shatter: 10 },
  },

  /* ---------------- materials: the tech-fantasy ladder ---------------- */
  materials: {
    flint: {
      name: 'Flint', tier: 1, statMult: 1.0, vessel: [2, 3], patience: [2, 3], dropWeight: 30, ascendsTo: null, weights: { blade: 1.4, blood: 1.2, ward: 0.6 },
    },
    bone: {
      name: 'Bone', tier: 1, statMult: 0.9, vessel: [2, 4], patience: [2, 4], dropWeight: 25, ascendsTo: null, weights: { beast: 1.6, spirit: 1.3, ember: 0.5 },
    },
    hide: {
      name: 'Hide', tier: 1, statMult: 0.9, vessel: [2, 3], patience: [3, 4], dropWeight: 30, ascendsTo: 'quilted', weights: { beast: 1.3, swift: 1.3, ward: 0.8 },
    },
    quilted: {
      name: 'Quilted', tier: 2, statMult: 1.2, vessel: [2, 4], patience: [3, 5], dropWeight: 16, ascendsTo: 'bronzescale', weights: { ward: 1.3, life: 1.3, blade: 0.6 },
    },
    copper: {
      name: 'Copper', tier: 2, statMult: 1.25, vessel: [2, 4], patience: [3, 5], dropWeight: 18, ascendsTo: 'bronze', weights: { river: 1.3, fortune: 1.3 },
    },
    bronze: {
      name: 'Bronze', tier: 3, statMult: 1.6, vessel: [3, 5], patience: [4, 6], dropWeight: 9, ascendsTo: 'skymetal', weights: { blade: 1.2, ward: 1.2, blunt: 1.2 },
    },
    obsidian: {
      name: 'Obsidian', tier: 3, statMult: 1.55, vessel: [3, 5], patience: [2, 4], dropWeight: 8, ascendsTo: null, weights: { blade: 1.8, blood: 1.8, ward: 0.4 },
    },
    jade: {
      name: 'Jade', tier: 4, statMult: 1.7, vessel: [4, 5], patience: [4, 6], dropWeight: 4, ascendsTo: null, weights: { spirit: 1.8, ward: 1.5, blood: 0.5 },
    },
    amber: {
      name: 'Amber', tier: 4, statMult: 1.65, vessel: [4, 5], patience: [4, 6], dropWeight: 4, ascendsTo: null, weights: { ember: 1.7, fortune: 1.5, spirit: 1.3 },
    },
    bronzescale: {
      name: 'Bronze-scale', tier: 4, statMult: 1.9, vessel: [4, 5], patience: [4, 6], dropWeight: 3, ascendsTo: 'rivetmail', weights: { ward: 1.6, life: 1.3 },
    },
    skymetal: {
      name: 'Skymetal', tier: 5, statMult: 2.3, vessel: [4, 6], patience: [5, 7], dropWeight: 1, ascendsTo: null, weights: { blade: 1.4, spirit: 1.4, ember: 1.3 },
    },
    rivetmail: {
      name: 'Riveted Mail', tier: 6, statMult: 2.6, vessel: [5, 6], patience: [5, 8], dropWeight: 0.3, ascendsTo: null, weights: { ward: 2.0, life: 1.5 },
    },
  },

  /* ---------------- forms (bases) ---------------- */
  forms: {
    handaxe: {
      name: 'Handaxe', kind: 'weapon', kindLabel: 'One-hand weapon', w: 1, h: 2, icon: 'axe', weapon: { dmg: [7, 13], aps: 1.3 }, tags: ['blade'], weights: { blade: 1.3 }, materials: ['flint', 'copper', 'bronze', 'obsidian', 'skymetal'], implicit: { label: '15% increased Physical Damage', stat: { id: 'phys_pct', v: 15 } },
    },
    spear: {
      name: 'Spear', kind: 'weapon', kindLabel: 'Reach weapon', w: 1, h: 4, icon: 'spear', weapon: { dmg: [10, 22], aps: 1.0 }, tags: ['reach'], weights: { reach: 1.5 }, materials: ['flint', 'bone', 'copper', 'bronze', 'obsidian', 'skymetal'], implicit: { label: 'Strikes keep foes at reach', stat: null },
    },
    macuahuitl: {
      name: 'Macuahuitl', kind: 'weapon', kindLabel: 'Edged club', w: 2, h: 3, icon: 'club', weapon: { dmg: [14, 30], aps: 0.85 }, tags: ['blade', 'blunt', 'blood'], weights: { blood: 1.6 }, materials: ['obsidian', 'flint', 'bone'], implicit: { label: 'Hits cause Bleeding', stat: null },
    },
    atlatl: {
      name: 'Atlatl', kind: 'weapon', kindLabel: 'Dart-thrower', w: 1, h: 3, icon: 'atlatl', weapon: { dmg: [8, 18], aps: 1.1 }, tags: ['reach', 'swift'], weights: { swift: 1.4 }, materials: ['bone', 'copper', 'bronze'], implicit: { label: '+20% Projectile Range', stat: null },
    },
    khopesh: {
      name: 'Khopesh', kind: 'weapon', kindLabel: 'Sickle-sword', w: 1, h: 3, icon: 'khopesh', weapon: { dmg: [11, 20], aps: 1.2 }, tags: ['blade'], weights: { blade: 1.2, fortune: 1.2 }, materials: ['copper', 'bronze', 'skymetal'], implicit: { label: '+10% Attack Speed', stat: { id: 'atk_speed', v: 10 } },
    },
    sling: {
      name: 'Sling', kind: 'weapon', kindLabel: 'Sling', w: 1, h: 2, icon: 'sling', weapon: { dmg: [5, 16], aps: 1.15 }, tags: ['reach', 'swift'], weights: { swift: 1.3 }, materials: ['hide', 'quilted'], implicit: { label: 'Ignores half of Ward', stat: null },
    },
    hideshield: {
      name: 'Shield', kind: 'shield', kindLabel: 'Shield', w: 2, h: 3, icon: 'shield', armor: 45, tags: ['ward'], weights: { ward: 1.5 }, materials: ['hide', 'bronze', 'bronzescale', 'rivetmail'], implicit: { label: '+4% Chance to Block', stat: { id: 'block', v: 4 } },
    },
    wrap: {
      name: 'Wrap', kind: 'body', kindLabel: 'Body wrap', w: 2, h: 3, icon: 'wrap', armor: 60, tags: ['ward', 'life'], weights: { life: 1.2 }, materials: ['hide', 'quilted', 'bronzescale', 'rivetmail'], implicit: { label: '+15 to Maximum Life', stat: { id: 'life', v: 15 } },
    },
    crest: {
      name: 'Crest', kind: 'helmet', kindLabel: 'Headpiece', w: 2, h: 2, icon: 'crest', armor: 25, tags: ['ward', 'spirit'], weights: { spirit: 1.2 }, materials: ['bone', 'hide', 'copper', 'bronze', 'jade'], implicit: { label: '+10 to Maximum Spirit', stat: { id: 'spirit', v: 10 } },
    },
    grips: {
      name: 'Grips', kind: 'gloves', kindLabel: 'Handwraps', w: 2, h: 2, icon: 'grips', armor: 18, tags: ['blade', 'swift'], weights: {}, materials: ['hide', 'quilted', 'bronzescale'], implicit: { label: '+8% Attack Speed', stat: { id: 'atk_speed', v: 8 } },
    },
    sandals: {
      name: 'Sandals', kind: 'boots', kindLabel: 'Footwear', w: 2, h: 2, icon: 'sandals', armor: 14, tags: ['swift'], weights: { swift: 1.6 }, materials: ['hide', 'quilted'], implicit: { label: '+10% Movement Speed', stat: { id: 'move', v: 10 } },
    },
    girdle: {
      name: 'Girdle', kind: 'belt', kindLabel: 'Waistband', w: 2, h: 1, icon: 'girdle', armor: 0, tags: ['life'], weights: { life: 1.3 }, materials: ['hide', 'quilted', 'copper'], implicit: { label: '+12 to Maximum Life', stat: { id: 'life', v: 12 } },
    },
    gorget: {
      name: 'Gorget', kind: 'amulet', kindLabel: 'Neckpiece', w: 1, h: 1, icon: 'gorget', armor: 0, tags: ['spirit', 'ward'], weights: { spirit: 1.4 }, materials: ['jade', 'amber', 'bone', 'copper'], implicit: { label: '+8 to All Attributes', stat: { id: 'attrs', v: 8 } },
    },
    ring: {
      name: 'Ring', kind: 'ring', kindLabel: 'Ring', w: 1, h: 1, icon: 'ring', armor: 0, tags: ['fortune'], weights: { fortune: 1.2 }, materials: ['bone', 'copper', 'jade', 'amber'], implicit: { label: '+12 to Maximum Life', stat: { id: 'life', v: 12 } },
    },
    curio: {
      name: 'Curio', kind: 'curio', kindLabel: 'Curio', w: 1, h: 1, icon: 'curio', armor: 0, tags: [], noVessel: true, materials: ['bone', 'jade', 'amber'], implicit: null,
    },
  },

  /* ---------------- brand mods (flat/scalar only — craft is arithmetic) ----
     tiers: index 0 = T1 (common, weak) … index 2 = T3 (rare, strong).      */
  brandMods: {
    keen: {
      label: '+{v}% increased Physical Damage', shape: 'scalar', tags: ['blade'], kinds: ['weapon'], weight: 12, tiers: [{ roll: [8, 14] }, { roll: [15, 22], minIlvl: 20 }, { roll: [23, 32], minIlvl: 50 }],
    },
    heavy: {
      label: '+{v} flat Damage', shape: 'flat', tags: ['blunt', 'blade'], kinds: ['weapon'], weight: 12, tiers: [{ roll: [2, 4] }, { roll: [5, 8], minIlvl: 25 }, { roll: [9, 14], minIlvl: 55 }],
    },
    swift_haft: {
      label: '+{v}% Attack Speed', shape: 'scalar', tags: ['swift'], kinds: ['weapon'], weight: 9, tiers: [{ roll: [5, 8] }, { roll: [9, 13], minIlvl: 25 }, { roll: [14, 18], minIlvl: 55 }],
    },
    bloodgroove: {
      label: '+{v}% chance to Bleed on hit', shape: 'scalar', tags: ['blood'], kinds: ['weapon'], weight: 7, tiers: [{ roll: [10, 15] }, { roll: [16, 25], minIlvl: 30 }],
    },
    long_reach: {
      label: '+{v}% increased Reach', shape: 'scalar', tags: ['reach'], kinds: ['weapon'], weight: 7, tiers: [{ roll: [6, 10] }, { roll: [11, 16], minIlvl: 30 }],
    },
    warded: {
      label: '+{v}% increased Ward', shape: 'scalar', tags: ['ward'], kinds: ['shield', 'body', 'helmet', 'gloves', 'boots'], weight: 12, tiers: [{ roll: [10, 18] }, { roll: [19, 28], minIlvl: 20 }, { roll: [29, 40], minIlvl: 50 }],
    },
    hale: {
      label: '+{v} to Maximum Life', shape: 'flat', tags: ['life'], kinds: ['weapon', 'shield', 'body', 'helmet', 'gloves', 'boots', 'belt', 'amulet', 'ring'], weight: 12, tiers: [{ roll: [10, 20] }, { roll: [21, 35], minIlvl: 25 }, { roll: [36, 55], minIlvl: 55 }],
    },
    spirited: {
      label: '+{v} to Maximum Spirit', shape: 'flat', tags: ['spirit'], kinds: ['helmet', 'amulet', 'ring', 'weapon'], weight: 10, tiers: [{ roll: [8, 15] }, { roll: [16, 26], minIlvl: 25 }, { roll: [27, 40], minIlvl: 55 }],
    },
    emberkiss: {
      label: 'Adds {v} Ember Damage', shape: 'flat', tags: ['ember'], kinds: ['weapon', 'amulet'], weight: 6, tiers: [{ roll: [3, 7] }, { roll: [8, 14], minIlvl: 30 }, { roll: [15, 22], minIlvl: 60 }],
    },
    riverblessed: {
      label: '+{v}% to River Resistance', shape: 'scalar', tags: ['river', 'ward'], kinds: ['shield', 'body', 'helmet', 'belt', 'amulet', 'ring'], weight: 8, tiers: [{ roll: [8, 15] }, { roll: [16, 25], minIlvl: 25 }],
    },
    emberward: {
      label: '+{v}% to Ember Resistance', shape: 'scalar', tags: ['ember', 'ward'], kinds: ['shield', 'body', 'helmet', 'belt', 'amulet', 'ring'], weight: 8, tiers: [{ roll: [8, 15] }, { roll: [16, 25], minIlvl: 25 }],
    },
    surefoot: {
      label: '+{v}% Movement Speed', shape: 'scalar', tags: ['swift'], kinds: ['boots'], weight: 9, tiers: [{ roll: [5, 9] }, { roll: [10, 15], minIlvl: 30 }],
    },
    keen_eye: {
      label: '+{v}% Critical Chance', shape: 'scalar', tags: ['blade', 'swift'], kinds: ['weapon', 'ring'], weight: 7, tiers: [{ roll: [8, 14] }, { roll: [15, 22], minIlvl: 35 }],
    },
    wealthy: {
      label: '+{v}% Goods Found', shape: 'scalar', tags: ['fortune'], kinds: ['weapon', 'shield', 'body', 'helmet', 'gloves', 'boots', 'belt', 'amulet', 'ring'], weight: 8, tiers: [{ roll: [6, 12] }, { roll: [13, 20], minIlvl: 30 }],
    },
    beastbane: {
      label: '+{v}% Damage against Beasts', shape: 'scalar', tags: ['beast'], kinds: ['weapon'], weight: 7, tiers: [{ roll: [10, 18] }, { roll: [19, 30], minIlvl: 30 }],
    },
    strongback: {
      label: '+{v} to All Attributes', shape: 'flat', tags: ['life', 'spirit'], kinds: ['amulet', 'ring', 'belt'], weight: 6, tiers: [{ roll: [3, 6] }, { roll: [7, 11], minIlvl: 35 }],
    },
  },

  /* ---------------- bond themes (named conditional memories) ---------------- */
  themes: {
    slaughter: {
      name: 'Slaughter',
      color: '#f87171',
      mods: {
        blood_price: { name: 'The Blood Price', label: 'Recover {v}% of Life on Kill', shape: 'trigger', roll: [2, 3] },
        battle_rhythm: { name: 'Battle Rhythm', label: '+{v}% Attack Speed for 4s after a Kill', shape: 'trigger', roll: [12, 18] },
        read_wound: { name: 'Read the Wound', label: '+{v}% Critical Chance against Bleeding foes', shape: 'conditional', roll: [15, 25] },
      },
      epithets: ['Hunger', 'Fang', 'Reckoning'],
      adjs: ['Red', 'Grim', 'Howling'],
      power: 'Echoing Kill — slain foes have 15% chance to die twice, doubling their spoils.',
      memory: 'It has learned to hunger.',
    },
    warding: {
      name: 'Warding',
      color: '#93c5fd',
      mods: {
        shieldwall: { name: 'The Shieldwall', label: 'Regain {v} Life when you Block', shape: 'trigger', roll: [8, 14] },
        stand_ground: { name: 'Stand Your Ground', label: '+{v}% Chance to Block while stationary', shape: 'conditional', roll: [3, 5] },
        old_grudge: { name: 'Old Grudge', label: '+{v}% Ward for 2s when Hit', shape: 'trigger', roll: [20, 30] },
      },
      epithets: ['Oath', 'Bulwark', 'Vigil'],
      adjs: ['Unbroken', 'Stone', 'Dawnlit'],
      power: 'Last Stand — a killing blow instead leaves you at 1 Life, once per battle.',
      memory: 'It has learned to endure.',
    },
    spiritwork: {
      name: 'Spiritwork',
      color: '#c084fc',
      mods: {
        clear_mind: { name: 'Clear Mind', label: '+{v}% Rite Power while Spirit is above three-quarters', shape: 'conditional', roll: [12, 20] },
        ember_tithe: { name: 'Harvest', label: 'Recover {v}% of Spirit on Kill', shape: 'trigger', roll: [3, 5] },
        veil_wise: { name: 'Superstition', label: '{v}% chance to shrug off Curses', shape: 'conditional', roll: [10, 18] },
      },
      epithets: ['Whisper', 'Cinder', 'Riddle'],
      adjs: ['Silent', 'Ashen', 'Nine-Veiled'],
      power: 'Twinned Voice — rites have 12% chance to speak twice, free.',
      memory: 'It has learned to listen.',
    },
    wayfaring: {
      name: 'Wayfaring',
      color: '#86efac',
      mods: {
        dead_sprint: { name: 'Dead Sprint', label: '+{v}% Movement Speed for 3s on Kill', shape: 'trigger', roll: [10, 16] },
        sidestep: { name: 'Sidestep', label: '{v}% chance to Avoid thrown weapons while moving', shape: 'conditional', roll: [10, 16] },
        road_lore: { name: 'Second Wind', label: 'Regain {v} Life per second while moving', shape: 'conditional', roll: [2, 4] },
      },
      epithets: ['Stride', 'Wind', 'Lantern'],
      adjs: ['Fleet', 'Pale', 'Far'],
      power: 'Untraceable — the first strike against you in every battle misses.',
      memory: 'It has learned the roads.',
    },
  },

  archetypes: {
    redhand: { name: 'Butcher', themeId: 'slaughter' },
    shieldbearer: { name: 'Guard', themeId: 'warding' },
    ashspeaker: { name: 'Seer', themeId: 'spiritwork' },
    farwalker: { name: 'Scout', themeId: 'wayfaring' },
  },

  /* ---------------- trophies (hunted power, TQ/GD homage) ---------------- */
  trophies: {
    boar_tusk: {
      name: 'Boar Tusk',
      fragments: 5,
      kinds: ['weapon', 'belt'],
      mods: [{ stat: 'phys_pct', v: 10, label: '+{v}% increased Physical Damage', shape: 'scalar' }],
      completionBonus: { label: 'Charge — your first strike each battle cannot be blocked', shape: 'trigger' },
    },
    wolf_fang: {
      name: 'Wolf Fang',
      fragments: 5,
      kinds: ['weapon', 'gloves'],
      mods: [{ stat: 'atk_speed', v: 6, label: '+{v}% Attack Speed', shape: 'scalar' }],
      completionBonus: { label: 'Pack Sense — you cannot be surprised', shape: 'conditional' },
    },
    river_pearl: {
      name: 'River Pearl',
      fragments: 3,
      kinds: ['amulet', 'ring', 'helmet'],
      mods: [{ stat: 'spirit', v: 12, label: '+{v} to Maximum Spirit', shape: 'flat' }],
      completionBonus: { label: 'Undertow — your rites chill their targets', shape: 'trigger' },
    },
    ember_shell: {
      name: 'Beetle Shell',
      fragments: 3,
      kinds: ['shield', 'body'],
      mods: [{ stat: 'ember_res', v: 15, label: '+{v}% to Ember Resistance', shape: 'scalar' }],
      completionBonus: { label: 'Cinder Skin — attackers are singed', shape: 'trigger' },
    },
    knucklebone: {
      name: 'Knucklebone',
      fragments: 3,
      kinds: ['amulet', 'ring', 'belt'],
      mods: [{ stat: 'fortune', v: 10, label: '+{v}% Goods Found', shape: 'scalar' }],
      completionBonus: { label: 'Grandmother’s Rite — once a day, reroll one omen', shape: 'grant' },
    },
  },

  /* ---------------- craft tools ---------------- */
  pigments: {
    red_ochre: { name: 'Red Ochre', weights: { blade: 3, blood: 3, blunt: 2, ward: 0.3, spirit: 0.3 } },
    woad: { name: 'Woad', weights: { ward: 3, life: 2.5, blade: 0.3, blood: 0.2 } },
    soot: { name: 'Soot', weights: { spirit: 3, ember: 3, fortune: 0.5, life: 0.4 } },
    ochre_gold: { name: 'Marsh Ochre', weights: { fortune: 3, swift: 2.5, river: 2 } },
  },
  omens: {
    entrail_omen: { name: 'Entrail Omen', tag: 'ward' },
    bird_omen: { name: 'Bird Omen', tag: 'swift' },
    smoke_omen: { name: 'Smoke Omen', tag: 'spirit' },
    blood_omen: { name: 'Blood Omen', tag: 'blood' },
  },

  /* ---------------- panoply (player-authored sets) ---------------- */
  panoply: {
    2: { label: 'Panoply (2): your awakened relics hum together — +10% to all their bond values' },
    3: { label: 'Panoply (3): a saga made solid — awakened powers trigger 25% more often' },
  },

  /* ---------------- encounters ---------------- */
  encounters: [
    { text: 'ambushed a boar sounder at the ford', themes: { slaughter: 2, wayfaring: 1 }, trophy: 'boar_tusk', trophyChance: 0.6 },
    { text: 'held the shield-line at Delaford weir', themes: { warding: 3 }, trophy: 'ember_shell', trophyChance: 0.25 },
    { text: 'sang down a river-haunt', themes: { spiritwork: 2, warding: 1 }, trophy: 'river_pearl', trophyChance: 0.5 },
    { text: 'outran the toll-reeves of Verdigris', themes: { wayfaring: 3 }, trophyChance: 0.1 },
    { text: 'culled the barrow-wolves', themes: { slaughter: 2, spiritwork: 1 }, trophy: 'wolf_fang', trophyChance: 0.6 },
    { text: 'weathered the ash-storm on the high path', themes: { warding: 2, wayfaring: 1 }, trophyChance: 0.15 },
    { text: 'traded riddles with a canal-witch', themes: { spiritwork: 3 }, trophy: 'knucklebone', trophyChance: 0.35 },
    { text: 'broke a raider skiff on the mudflats', themes: { slaughter: 2, warding: 1 }, trophyChance: 0.2 },
    { text: 'charted the drowned stair by rushlight', themes: { wayfaring: 2, spiritwork: 1 }, trophy: 'river_pearl', trophyChance: 0.3 },
    { text: 'felled the tusked alderbeast', themes: { slaughter: 3 }, trophy: 'boar_tusk', trophyChance: 0.7 },
  ],

  nameTables: {
    pre: ['Grim', 'Sable', 'Ashen', 'Reed', 'Ember', 'Frost', 'Dusk', 'Copper', 'Thorn', 'Vesper'],
    post: ['Whisper', 'Ward', 'Bite', 'Song', 'Pledge', 'Shard', 'Gloam', 'Tithe'],
  },

  /* ---------------- character sheet derivation ---------------- */
  derive(sums, items, ctx) {
    const s = id => sums[id] || 0;
    const level = ctx.level || 1;
    let ward = 0;
    let dmg = 0;
    items.forEach((it) => {
      const f = pack.forms[it.formId];
      const m = pack.materials[it.materialId];
      if (f.armor) ward += f.armor * m.statMult;
    });
    const mh = items.find(it => pack.forms[it.formId].weapon);
    if (mh) {
      const f = pack.forms[mh.formId];
      const m = pack.materials[mh.materialId];
      const avg = ((f.weapon.dmg[0] + f.weapon.dmg[1]) / 2) * m.statMult + s('heavy') + s('emberkiss');
      dmg = Math.round(avg * (1 + s('phys_pct') / 100 + s('keen') / 100) * f.weapon.aps * (1 + s('atk_speed') / 100));
    }
    return {
      life: Math.round(90 + 10 * (level - 1) + s('hale') + 2 * s('strongback') + s('life')),
      spirit: Math.round(50 + s('spirited') + s('strongback') + s('spirit')),
      ward: Math.round(ward * (1 + s('warded') / 100)),
      damage: dmg,
      move: Math.round(s('surefoot') + s('move')),
      goods: Math.round(s('wealthy') + s('fortune')),
      resEmber: Math.min(75, s('emberward') + s('ember_res')),
      resRiver: Math.min(75, s('riverblessed')),
    };
  },
};

export default pack;
