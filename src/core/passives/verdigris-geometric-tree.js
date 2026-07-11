import {
  VERDIGRIS_SKILL_TREE_TOTALS,
} from './verdigris-skill-tree.js';

export const VERDIGRIS_AXIS_META = Object.freeze({
  STR: { label: 'Strength', short: 'STR', color: '#f06a54', path: 'Iron Route' },
  DEX: { label: 'Dexterity', short: 'DEX', color: '#56c88b', path: 'Quickstep Trace' },
  INT: { label: 'Intellect', short: 'INT', color: '#6e9cff', path: 'Memory Thread' },
  HYBRID: { label: 'Hybrid', short: 'HYB', color: '#d7bc7c', path: 'Braided Span' },
});

export const VERDIGRIS_DERIVED_LABELS = Object.freeze({
  life: ['Life', ''],
  mana: ['Mana', ''],
  armour: ['Armour', ''],
  evasion: ['Evasion', ''],
  energyShield: ['Ward', ''],
  attackDamage: ['Melee', '%'],
  spellDamage: ['Spell', '%'],
  projectileDamage: ['Ranged', '%'],
  minionDamage: ['Ally', '%'],
  attackSpeed: ['Atk Spd', '%'],
  castSpeed: ['Cast Spd', '%'],
  critChance: ['Crit', '%'],
  allResistances: ['Resist', '%'],
  ailmentEffect: ['Ailment', '%'],
  blockChance: ['Block', '%'],
  cooldownRecovery: ['Recovery', '%'],
});

const RADIUS = 72;
const SUBTREE_SPACING = 58;
const TREE_LAYERS = VERDIGRIS_SKILL_TREE_TOTALS.layers;
const PERCENT_STATS = new Set([
  'attackDamage',
  'spellDamage',
  'projectileDamage',
  'minionDamage',
  'attackSpeed',
  'castSpeed',
  'critChance',
  'allResistances',
  'ailmentEffect',
  'blockChance',
  'cooldownRecovery',
]);

const BASE_CHARACTER = Object.freeze({
  life: 1000,
  mana: 300,
  armour: 0,
  evasion: 0,
  energyShield: 0,
  attackDamage: 100,
  spellDamage: 100,
  projectileDamage: 100,
  minionDamage: 100,
  attackSpeed: 100,
  castSpeed: 100,
  critChance: 5,
  allResistances: 0,
  ailmentEffect: 0,
  blockChance: 0,
  cooldownRecovery: 0,
});

const AXIS_VECTORS = {
  STR: { x: 0.866, y: 0.5 },
  DEX: { x: -0.866, y: 0.5 },
  INT: { x: 0, y: -1 },
};

const HEX_DIRECTIONS = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
];

const AXIS_DIRECTIONS = {
  STR: { q: 1, r: 0 },
  DEX: { q: -1, r: 1 },
  INT: { q: 0, r: -1 },
};

const NODE_EFFECTS = {
  STR: [
    { tag: 'weapon', names: ['Hammer Cant', 'Iron Grip', 'Break Rhythm', 'Headsplitter', 'Warhand', 'Heft', 'Follow Through'], stat: 'attackDamage', amount: 9, line: '+9% melee and heavy weapon damage' },
    { tag: 'armour', names: ['Braced Plate', 'Shield Memory', 'Stone Vein', 'Close Guard', 'Tidewall', 'Thick Skin', 'Padded Guard'], stat: 'armour', amount: 85, line: '+85 Armour' },
    { tag: 'life', names: ['Red Marrow', 'Field Surgeon', 'Second Breath', 'Blood Reserve', 'Unbroken Core', 'Old Scars', 'Deep Lungs'], stat: 'life', amount: 55, line: '+55 maximum Life' },
    { tag: 'block', names: ['Doorframe Stance', 'Shield Hook', 'Locking Elbow', 'Iron Angle', 'Line Holder', 'Raised Rim', 'Braced Wrist'], stat: 'blockChance', amount: 2, line: '+2% Block Chance' },
  ],
  DEX: [
    { tag: 'blade', names: ['Knife Tempo', 'Twin Feint', 'Edge Step', 'Whisper Cut', 'Clean Draw', 'Short Grip', 'Off Hand'], stat: 'attackSpeed', amount: 4, line: '+4% Attack Speed' },
    { tag: 'evasion', names: ['Loose Footing', 'Wind Pocket', 'Slidecast', 'Narrow Escape', 'Pivot Guard', 'Light Step', 'Read the Room'], stat: 'evasion', amount: 90, line: '+90 Evasion Rating' },
    { tag: 'projectile', names: ['String Theory', 'Fletched Line', 'Far Hand', 'Ricochet Habit', 'Green Angle', 'Steady Loose', 'High Arc'], stat: 'projectileDamage', amount: 9, line: '+9% Projectile Damage' },
    { tag: 'critical', names: ['Clean Read', 'Soft Target', 'Needle Line', 'Second Look', 'Open Guard', 'Gap Finder', 'Cold Eye'], stat: 'critChance', amount: 0.8, line: '+0.8% Critical Strike Chance' },
  ],
  INT: [
    { tag: 'spell', names: ['Runic Memory', 'Cold Diagram', 'Amber Formula', 'Thoughtspark', 'Held Word', 'Chalk Line', 'Third Reading'], stat: 'spellDamage', amount: 10, line: '+10% Spell Damage' },
    { tag: 'energy-shield', names: ['Mirror Ward', 'Blue Aegis', 'Quiet Barrier', 'Glyph Skin', 'Second Sigil', 'Layered Thought', 'Glass Calm'], stat: 'energyShield', amount: 48, line: '+48 Ward' },
    { tag: 'minion', names: ['Familiar Line', 'Servant Rule', 'Bound Chorus', 'Living Ink', 'Lantern Host', 'Roll Call', 'Long Leash'], stat: 'minionDamage', amount: 9, line: '+9% Minion Damage' },
    { tag: 'mana', names: ['Deep Vessel', 'Blue Reserve', 'Stored Word', 'Mana Lattice', 'Quiet Font', 'Still Water', 'Spare Ink'], stat: 'mana', amount: 35, line: '+35 maximum Mana' },
  ],
  HYBRID: [
    { tag: 'elemental', names: ['Cross-Discipline', 'Joined Method', 'Two-Hand Thesis', 'Practical Lore', 'Measured Risk', 'Borrowed Fire', 'Split Study'], stat: 'spellDamage', amount: 6, line: '+6% Elemental and Spell Damage' },
    { tag: 'recovery', names: ['Deep Pockets', 'Reservoir Knot', 'Field Cache', 'Slow Burn', 'Held Breath', 'Short Rest', 'Second Course'], stat: 'cooldownRecovery', amount: 3, line: '+3% Cooldown Recovery Rate' },
    { tag: 'ailment', names: ['Marking Rule', 'Weighted Hex', 'Hex Vector', 'Fault Line', 'Soft Lock', 'Salted Wound', 'Slow Poison'], stat: 'ailmentEffect', amount: 7, line: '+7% Ailment Effect' },
    { tag: 'resistance', names: ['Weathered Thread', 'Salt Charm', 'Brass Omen', 'Fourfold Ward', 'Ash Measure', 'Oiled Cloak', 'Hearth Charm'], stat: 'allResistances', amount: 3, line: '+3% to all Elemental Resistances' },
  ],
};

const NOTABLES = {
  STR: [
    { name: 'Oath of the Front Line', stat: 'armour', amount: 240, lines: ['+240 Armour', 'When hit recently, +12% melee damage'] },
    { name: 'Anvil Reading', stat: 'attackDamage', amount: 22, lines: ['+22% Melee Damage', 'Stuns you inflict count as one rank stronger'] },
    { name: 'Red Standard', stat: 'life', amount: 180, lines: ['+180 maximum Life', 'War skills recover 3% Life on first target hit'] },
    { name: "Breaker's Posture", stat: 'attackDamage', amount: 25, lines: ['+25% damage against armoured enemies', 'Armour Break lasts 20% longer'] },
    { name: 'Berserker', stat: 'attackDamage', amount: 26, lines: ['+26% Melee Damage', '+10% Attack Speed while below half Life'] },
    { name: 'Gladiator', stat: 'blockChance', amount: 4, lines: ['+4% Block Chance', 'Blocking grants +8% melee damage for 3 seconds'] },
    { name: 'Hoplite', stat: 'armour', amount: 200, lines: ['+200 Armour', '+14% damage with spears and long weapons'] },
    { name: 'Warden', stat: 'life', amount: 150, lines: ['+150 maximum Life', 'Nearby allies take 6% less damage'] },
    { name: 'Executioner', stat: 'attackDamage', amount: 20, lines: ['+20% Melee Damage', 'Enemies below a fifth of their life take +25% damage from you'] },
  ],
  DEX: [
    { name: 'Needlework Footing', stat: 'evasion', amount: 260, lines: ['+260 Evasion Rating', 'First dodge after moving grants +8% Attack Speed'] },
    { name: 'Far Hand Geometry', stat: 'projectileDamage', amount: 22, lines: ['+22% Projectile Damage', 'Projectiles gain +1 rebound after travelling through a conduit loop'] },
    { name: 'Quiet Draw', stat: 'critChance', amount: 2.2, lines: ['+2.2% Critical Strike Chance', 'Critical misses refund a small amount of stamina'] },
    { name: 'Poison Ledger', stat: 'ailmentEffect', amount: 21, lines: ['+21% Ailment Effect', 'Poisons tick 12% faster on marked targets'] },
    { name: 'Duelist', stat: 'critChance', amount: 2.5, lines: ['+2.5% Critical Strike Chance', 'After you dodge, your next strike cannot miss'] },
    { name: 'Assassin', stat: 'attackSpeed', amount: 8, lines: ['+8% Attack Speed', '+30% Critical Damage Bonus against enemies at full life'] },
    { name: 'Falconer', stat: 'projectileDamage', amount: 20, lines: ['+20% Projectile Damage', 'Companions mark the first enemy they strike'] },
    { name: 'Corsair', stat: 'evasion', amount: 220, lines: ['+220 Evasion Rating', '+10% Movement Speed for 4 seconds after a kill'] },
    { name: 'Outrider', stat: 'attackSpeed', amount: 6, lines: ['+6% Attack Speed', 'Damage taken while moving is reduced by 8%'] },
  ],
  INT: [
    { name: "Archivist's Spark", stat: 'spellDamage', amount: 25, lines: ['+25% Spell Damage', 'Every third spell gains +12% area or chain range'] },
    { name: 'Ward in Two Parts', stat: 'energyShield', amount: 210, lines: ['+210 Ward', 'Half of broken Ward becomes Mana over 4 seconds'] },
    { name: 'Lanterns Answer', stat: 'minionDamage', amount: 23, lines: ['+23% Minion Damage', 'Summoned allies inherit 10% of your path attributes'] },
    { name: 'Blue Arithmetic', stat: 'mana', amount: 120, lines: ['+120 maximum Mana', 'Mana spent recently improves spell critical chance'] },
    { name: 'Alchemist', stat: 'cooldownRecovery', amount: 10, lines: ['+10% Cooldown Recovery Rate', 'Flasks and preparations last 20% longer'] },
    { name: 'Summoner', stat: 'minionDamage', amount: 25, lines: ['+25% Minion Damage', '+1 maximum companion while a loop conduit is complete'] },
    { name: 'Occultist', stat: 'ailmentEffect', amount: 20, lines: ['+20% Hex and Curse Effect', 'Cursed enemies deal 8% less damage to you'] },
    { name: 'Chronicler', stat: 'mana', amount: 100, lines: ['+100 maximum Mana', 'Repeating your previous spell costs 15% less'] },
    { name: 'Hierophant', stat: 'energyShield', amount: 180, lines: ['+180 Ward', 'Auras you cast gain +12% effect'] },
  ],
  HYBRID: [
    { name: 'Spellblade Interval', stat: 'spellDamage', amount: 21, lines: ['+21% mixed Attack and Spell Damage', 'Attack after casting grants +8 INT and +8 STR for 4 seconds'] },
    { name: 'Cunning Bulwark', stat: 'evasion', amount: 160, lines: ['+160 Evasion Rating', 'Defensive skills keep 15% of movement speed'] },
    { name: "Tutor's Ambush", stat: 'ailmentEffect', amount: 22, lines: ['+22% trap, mark, and ailment effect', 'Marked enemies count as studied'] },
    { name: 'Field Alchemy', stat: 'cooldownRecovery', amount: 12, lines: ['+12% Cooldown Recovery Rate', 'Recovery effects improve your weakest attribute'] },
    { name: 'Battlemage', stat: 'spellDamage', amount: 18, lines: ['+18% Spell Damage', '+18% Attack Damage while holding a two-handed weapon'] },
    { name: 'Inquisitor', stat: 'critChance', amount: 1.8, lines: ['+1.8% Critical Strike Chance', 'Criticals against hexed enemies recover 2% Mana'] },
    { name: 'Trickster', stat: 'evasion', amount: 180, lines: ['+180 Evasion Rating', 'Traps arm 30% faster'] },
    { name: 'Warpriest', stat: 'life', amount: 120, lines: ['+120 maximum Life', 'Healing you cast also grants a small ward'] },
    { name: 'Nightblade', stat: 'attackSpeed', amount: 6, lines: ['+6% Attack Speed', 'Spells cast from stealth are always critical'] },
  ],
};

const KEYSTONES = {
  STR: [
    { name: 'No Backward Step', lines: ['You cannot evade while standing still', 'Standing still grants +70% guard and +30% heavy damage'] },
    { name: 'Weight Has Memory', lines: ['Every recent stun grants +8 STR', 'Your movement speed cannot exceed its base value'] },
    { name: 'The Wall Moves', lines: ['Guard skills become attacks', 'Guard skills have 35% longer cooldowns'] },
  ],
  DEX: [
    { name: 'The Hand Arrives First', lines: ['Your first strike against each enemy always has advantage', 'You lose 20% guard while not moving'] },
    { name: 'Knife Before Name', lines: ['Critical hits apply your strongest ailment', 'Non-critical hits deal 18% less damage'] },
    { name: 'Thin Air Doctrine', lines: ['Every 6 allocated DEX paths grants one free dodge', 'You cannot block'] },
  ],
  INT: [
    { name: 'The Book Reads Back', lines: ['Spells repeat once at 45% effect', 'Repeated spells cost life instead of mana'] },
    { name: 'Borrowed Familiar', lines: ['Companions copy your last cast spell at reduced effect', 'You can summon one fewer permanent companion'] },
    { name: 'Cold Proof', lines: ['Ward also absorbs ailments', 'Life recovery is 30% slower while ward is full'] },
  ],
  HYBRID: [
    { name: 'Two Laws, One Price', lines: ['Your two highest attributes count as each other', 'Your lowest attribute cannot be raised by equipment'] },
    { name: 'Closed Circuit', lines: ['Completed circles empower their center twice', 'Path conduits cost one extra point outside circles'] },
    { name: 'The Practical Miracle', lines: ['Notables grant +8 to their nearest path attribute', 'Small passives grant 20% less direct effect'] },
  ],
};

// Ring-8 keystones are the Signs: birthsign-style build-defining picks,
// one big bonus and one real price.
export const VERDIGRIS_SIGNS = [
  { name: 'The Bull', lines: ['You cannot be slowed, knocked back, or interrupted', '-15% Movement Speed'] },
  { name: 'The Serpent', lines: ['Your critical strikes always poison, and poisons stack once more', 'You take 20% more damage from ailments'] },
  { name: 'The Tower', lines: ['+30% Block Chance while stationary', 'You cannot dodge'] },
  { name: 'The Steed', lines: ['+20% Movement Speed and skills can be used while moving', 'You cannot stand and fight: -20% damage while stationary'] },
  { name: 'The Shadow', lines: ['After 2 seconds unseen, your next action has advantage', 'Your maximum Life is 15% lower'] },
  { name: 'The Lantern', lines: ['Allies and companions near you gain +15% damage', 'You are always revealed to enemies'] },
  { name: 'The Scales', lines: ['Your attributes count as equal to their average', 'Attribute bonuses from equipment are halved'] },
  { name: 'The Crow', lines: ['Kills recently grant +1% damage each, up to +25%', 'The bonus resets if you go 6 seconds without a kill'] },
  { name: 'The Wheel', lines: ['Cooldowns recover 30% faster', 'Your skills cost 15% more'] },
];

const MASTERIES = {
  STR: { name: 'Mastery of Force', lines: ['Choose this region for weapons, armour, and direct confrontation.'] },
  DEX: { name: 'Mastery of Motion', lines: ['Choose this region for speed, precision, projectiles, and evasive play.'] },
  INT: { name: 'Mastery of Thought', lines: ['Choose this region for spells, wards, companions, and resource engines.'] },
  HYBRID: { name: 'Mastery of Method', lines: ['Hybrid areas reward builds that cross school boundaries.'] },
};

// Ring-7 axis milestones read as classic classes rather than a second "Mastery of X".
const GRAND_MASTERIES = {
  STR: { name: 'Champion', lines: ['+12% Melee Damage and +120 Armour', 'War banners and shouts affect a wider area.'] },
  DEX: { name: 'Acrobat', lines: ['+8% Attack Speed and +140 Evasion Rating', 'Dodging costs no stamina inside completed loops.'] },
  INT: { name: 'Archmage', lines: ['+12% Spell Damage and +80 maximum Mana', 'Your highest-cost spell gains +1 echo.'] },
  HYBRID: { name: 'Spellsword', lines: ['+9% Attack and Spell Damage', 'Weapon strikes recover 1% Mana.'] },
};

// Gateway annexes hang off the six ring-9 corners. Axis gateways sit on the
// game's axis directions (STR q+, DEX -q+r, INT -r); hybrid annexes take the
// corners between them.
export const VERDIGRIS_SUBTREES = [
  {
    id: 'vanguard',
    title: 'Vanguard Oath',
    gateway: { q: 9, r: 0 },
    axis: 'STR',
    nodes: [
      { id: 'vanguard-core', name: 'Raised Banner', type: 'notable', stat: 'armour', amount: 260, effects: ['+260 Armour', 'Allies behind you gain +8% damage'], tag: 'armour' },
      { id: 'vanguard-haft', name: 'Heavy Answer', type: 'small', stat: 'attackDamage', amount: 10, effects: ['+10% Heavy Weapon Damage'], tag: 'weapon' },
      { id: 'vanguard-blood', name: 'Red Reserve', type: 'small', stat: 'life', amount: 70, effects: ['+70 maximum Life'], tag: 'life' },
      { id: 'vanguard-lock', name: 'Shield Lock', type: 'small', stat: 'blockChance', amount: 3, effects: ['+3% Block Chance'], tag: 'block' },
      { id: 'vanguard-wall', name: 'Line Cannot Break', type: 'mastery', stat: 'allResistances', amount: 5, effects: ['+5% to all Elemental Resistances', 'Armour also reduces reflected hit damage'], tag: 'resistance' },
      { id: 'vanguard-apex', name: 'Hold the Door', type: 'keystone', stat: null, amount: 0, effects: ['While blocking, nearby allies count as on your path', 'Your movement speed is 25% lower'], tag: 'block' },
    ],
    layout: [[0, 0], [-58, 56], [58, 56], [0, 116], [-46, 176], [46, 228]],
    links: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5], [4, 5, true]],
  },
  {
    id: 'ranger',
    title: "Ranger's Writ",
    gateway: { q: -9, r: 9 },
    axis: 'DEX',
    nodes: [
      { id: 'ranger-core', name: 'Distance Contract', type: 'notable', stat: 'projectileDamage', amount: 24, effects: ['+24% Projectile Damage', 'First projectile after a dodge pierces'], tag: 'projectile' },
      { id: 'ranger-low', name: 'Low Branch', type: 'small', stat: 'evasion', amount: 95, effects: ['+95 Evasion Rating'], tag: 'evasion' },
      { id: 'ranger-far', name: 'Long String', type: 'small', stat: 'attackSpeed', amount: 4, effects: ['+4% Attack Speed with bows and thrown weapons'], tag: 'projectile' },
      { id: 'ranger-mark', name: 'Green Measure', type: 'notable', stat: 'critChance', amount: 1.8, effects: ['+1.8% Critical Strike Chance', 'Projectiles have +12% Critical Damage Bonus'], tag: 'critical' },
      { id: 'ranger-apex', name: 'No Loose Ends', type: 'keystone', stat: null, amount: 0, effects: ['Projectiles returning to you grant +18 DEX', 'You cannot gain bonuses from shields'], tag: 'projectile' },
    ],
    layout: [[0, 0], [-68, 42], [52, 74], [-96, 132], [10, 180]],
    links: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 4, true]],
  },
  {
    id: 'genius',
    title: 'Genius Circle',
    gateway: { q: 0, r: -9 },
    axis: 'INT',
    nodes: [
      { id: 'genius-core', name: 'Proof Engine', type: 'notable', stat: 'spellDamage', amount: 22, effects: ['+22% Spell Damage', 'Completed circles add +5 INT'], tag: 'spell' },
      { id: 'genius-left', name: 'Marginal Note', type: 'small', stat: 'mana', amount: 45, effects: ['+45 maximum Mana'], tag: 'mana' },
      { id: 'genius-right', name: 'Axiomatic Spark', type: 'small', stat: 'critChance', amount: 1.2, effects: ['+1.2% Spell Critical Strike Chance'], tag: 'critical' },
      { id: 'genius-lower', name: 'Blue Library', type: 'small', stat: 'energyShield', amount: 70, effects: ['+70 Ward'], tag: 'energy-shield' },
      { id: 'genius-cross', name: 'Impossible Lemma', type: 'mastery', stat: 'castSpeed', amount: 9, effects: ['+9% Cast Speed', 'Every allocated loop conduit grants +1% Spell Damage'], tag: 'spell' },
      { id: 'genius-apex', name: 'The Last Footnote', type: 'keystone', stat: null, amount: 0, effects: ['Allocated masteries also count as one small circle node', 'Conduits from this circle cost no extra points'], tag: 'theory' },
    ],
    layout: [[0, 0], [-76, -26], [76, -26], [-54, 74], [54, 74], [0, 150]],
    links: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 4, true], [3, 5], [4, 5]],
  },
  {
    id: 'spellblade',
    title: 'Spellblade Annex',
    gateway: { q: 9, r: -9 },
    axis: 'HYBRID',
    nodes: [
      { id: 'spellblade-core', name: 'Edge Formula', type: 'notable', stat: 'spellDamage', amount: 18, effects: ['+18% Spell Damage', '+18% Attack Damage if you cast recently'], tag: 'hybrid' },
      { id: 'spellblade-ink', name: 'Hot Ink', type: 'small', stat: 'castSpeed', amount: 5, effects: ['+5% Cast Speed'], tag: 'spell' },
      { id: 'spellblade-wrist', name: 'Wrist Ward', type: 'small', stat: 'energyShield', amount: 64, effects: ['+64 Ward'], tag: 'energy-shield' },
      { id: 'spellblade-tempo', name: 'One-Beat Riposte', type: 'small', stat: 'attackSpeed', amount: 5, effects: ['+5% Attack Speed after casting'], tag: 'weapon' },
      { id: 'spellblade-sigil', name: 'Burning Guard', type: 'notable', stat: 'allResistances', amount: 4, effects: ['+4% to all Elemental Resistances', 'Blocking ignites nearby enemies'], tag: 'resistance' },
      { id: 'spellblade-apex', name: 'Cast Through Steel', type: 'keystone', stat: null, amount: 0, effects: ['Attack skills can trigger your lowest-cost spell', 'Triggered spells deal 40% less damage'], tag: 'hybrid' },
    ],
    layout: [[0, 0], [-84, 18], [68, 50], [-44, 112], [78, 130], [8, 208]],
    links: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5], [3, 4, true]],
  },
  {
    id: 'skirmish',
    title: 'Skirmish Annex',
    gateway: { q: -9, r: 0 },
    axis: 'HYBRID',
    nodes: [
      { id: 'skirmish-core', name: "Brawler's Angle", type: 'notable', stat: 'attackDamage', amount: 18, effects: ['+18% close-range and thrown damage'], tag: 'weapon' },
      { id: 'skirmish-step', name: 'Side Step Guard', type: 'small', stat: 'evasion', amount: 82, effects: ['+82 Evasion Rating'], tag: 'evasion' },
      { id: 'skirmish-haft', name: 'Short Haft', type: 'small', stat: 'attackSpeed', amount: 5, effects: ['+5% Melee Attack Speed'], tag: 'blade' },
      { id: 'skirmish-hook', name: 'Hook and Heel', type: 'small', stat: 'blockChance', amount: 2, effects: ['+2% Block Chance while dual wielding or using a buckler'], tag: 'block' },
      { id: 'skirmish-apex', name: 'Win the Space', type: 'keystone', stat: null, amount: 0, effects: ['Moving into melee range grants advantage', 'Retreating removes it for 3 seconds'], tag: 'hybrid' },
    ],
    layout: [[0, 0], [-82, 52], [82, 52], [-24, 126], [40, 190]],
    links: [[0, 1], [0, 2], [1, 3], [2, 3, true], [3, 4]],
  },
  {
    id: 'seer',
    title: "Seer's Annex",
    gateway: { q: 0, r: 9 },
    axis: 'HYBRID',
    nodes: [
      { id: 'seer-core', name: 'Hidden Mark', type: 'notable', stat: 'ailmentEffect', amount: 19, effects: ['+19% Mark, Hex, and Ailment Effect'], tag: 'ailment' },
      { id: 'seer-silent', name: 'Silent Cast', type: 'small', stat: 'castSpeed', amount: 5, effects: ['+5% Cast Speed while unseen'], tag: 'spell' },
      { id: 'seer-night', name: 'Night Step', type: 'small', stat: 'evasion', amount: 88, effects: ['+88 Evasion Rating'], tag: 'evasion' },
      { id: 'seer-ink', name: 'Black Ledger', type: 'small', stat: 'minionDamage', amount: 8, effects: ['+8% Minion and Trap Damage'], tag: 'minion' },
      { id: 'seer-lens', name: 'Wrong Future', type: 'mastery', stat: 'cooldownRecovery', amount: 10, effects: ['+10% Cooldown Recovery Rate', 'Hexed enemies have 10% reduced Critical Damage Bonus'], tag: 'spell' },
      { id: 'seer-apex', name: 'Seen First', type: 'keystone', stat: null, amount: 0, effects: ['Marked enemies are always revealed', 'Unmarked enemies take 15% less damage from you'], tag: 'ailment' },
    ],
    layout: [[0, 0], [-64, 40], [64, 40], [-88, 118], [28, 130], [-20, 210]],
    links: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5], [1, 4, true]],
  },
];

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
export const round = value => Math.round(value * 100) / 100;
export const axialKey = (q, r) => `${q},${r}`;
export const edgeKey = (a, b) => [a, b].sort().join(':');
export const axisColor = axis => VERDIGRIS_AXIS_META[axis]?.color || VERDIGRIS_AXIS_META.HYBRID.color;
export const statSuffix = key => (PERCENT_STATS.has(key) ? '%' : '');
export const formatDerivedLabel = key => VERDIGRIS_DERIVED_LABELS[key]?.[0] || key;

export const formatNumber = (value) => {
  const rounded = round(value);
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(Math.abs(rounded) < 10 ? 2 : 1).replace(/0+$/, '').replace(/\.$/, '');
};

export const formatAttrs = (attrs = {}) => Object.entries(attrs)
  .filter(([, value]) => value > 0)
  .map(([key, value]) => `+${value} ${key}`)
  .join(', ') || '+1 flexible attribute';

export const formatDerivedValue = (key, value) => `${formatNumber(value)}${statSuffix(key)}`;

export const hexDistance = (hexOrQ, maybeR = null) => {
  const q = typeof hexOrQ === 'object' ? hexOrQ.q : hexOrQ;
  const r = typeof hexOrQ === 'object' ? hexOrQ.r : maybeR;
  const s = -q - r;
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
};

const toPixel = hex => ({
  x: RADIUS * (hex.q + hex.r / 2),
  y: RADIUS * (hex.r * Math.sqrt(3) / 2),
});

const neighbor = (hex, i) => {
  const d = HEX_DIRECTIONS[i % 6];
  return { q: hex.q + d.q, r: hex.r + d.r };
};

const normalizeVector = (vector) => {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
};

const hexRingIndex = (hex, ring) => {
  if (ring === 0) return 0;
  let cursor = { q: 0, r: 0 };
  for (let k = 0; k < ring; k += 1) cursor = neighbor(cursor, 4);
  let index = 0;
  for (let side = 0; side < 6; side += 1) {
    for (let step = 0; step < ring; step += 1) {
      if (cursor.q === hex.q && cursor.r === hex.r) return index;
      cursor = neighbor(cursor, side);
      index += 1;
    }
  }
  return -1;
};

const isHexCorner = (hex, ring) => {
  const s = -hex.q - hex.r;
  return [Math.abs(hex.q), Math.abs(hex.r), Math.abs(s)].filter(value => value === ring).length >= 2;
};

const isPrimaryAxisNode = (hex, ring) => (
  (hex.q === ring && hex.r === 0)
  || (hex.q === 0 && hex.r === -ring)
  || (hex.q === -ring && hex.r === ring)
);

const nodeTypeFor = (hex, ring) => {
  if (ring === 0) return 'origin';
  const index = hexRingIndex(hex, ring);
  const corner = isHexCorner(hex, ring);
  const axisNode = isPrimaryAxisNode(hex, ring);
  if (ring === TREE_LAYERS && corner) return 'gateway';
  if (ring === 6 && index % 6 === 3) return 'keystone';
  if (ring === 8 && index % 8 === 4) return 'keystone';
  if ((ring === 3 || ring === 5 || ring === 7) && axisNode) return 'mastery';
  if (ring === 2 && index % 2 === 0) return 'notable';
  if (ring === 4 && index % 4 === 2) return 'notable';
  if (ring === 5 && index % 5 === 2) return 'notable';
  if (ring === 6 && index % 6 === 0) return 'notable';
  if (ring === 7 && index % 7 === 2) return 'notable';
  if (ring === 8 && index % 8 === 0) return 'notable';
  if (ring === TREE_LAYERS && index % 7 === 3) return 'notable';
  return 'small';
};

// PoE convention: every passive costs 1 regardless of power; travel is the real cost.
const nodeCost = type => (type === 'origin' ? 0 : 1);

const axisWeightsFromPosition = (pos) => {
  const length = Math.hypot(pos.x, pos.y);
  if (length < 0.001) return { STR: 1 / 3, DEX: 1 / 3, INT: 1 / 3 };
  const unit = { x: pos.x / length, y: pos.y / length };
  const raw = Object.fromEntries(Object.entries(AXIS_VECTORS).map(([axis, vector]) => {
    const dot = Math.max(0, unit.x * vector.x + unit.y * vector.y);
    return [axis, dot * dot];
  }));
  const total = Object.values(raw).reduce((sum, value) => sum + value, 0) || 1;
  return Object.fromEntries(Object.entries(raw).map(([axis, value]) => [axis, value / total]));
};

const dominantAxis = (weights) => {
  const ordered = Object.entries(weights).sort((a, b) => b[1] - a[1]);
  if (!ordered.length || ordered[0][1] - (ordered[1]?.[1] || 0) < 0.18) return 'HYBRID';
  return ordered[0][0];
};

const pathAttributesFromWeights = (weights, ring) => {
  const scale = ring > 7 ? 8 : ring > 5 ? 7 : ring > 3 ? 6 : 5;
  const attrs = {
    STR: Math.round((weights.STR || 0) * scale),
    DEX: Math.round((weights.DEX || 0) * scale),
    INT: Math.round((weights.INT || 0) * scale),
  };
  const strongest = Object.entries(weights).sort((a, b) => b[1] - a[1])[0]?.[0] || 'STR';
  attrs[strongest] = Math.max(1, attrs[strongest]);
  return attrs;
};

// Nudge one point from the dominant axis into the axis the conduit is
// *second* closest to at its sampled control point. Each option samples a
// different perpendicular-offset position, so the inner and outer arcs lean
// toward whichever neighbouring axis they actually curve toward — a conduit
// hugging the STR axis carries STR + its nearer neighbour, never the far one.
const biasArcAttributes = (attrs, weights) => {
  const copy = { ...attrs };
  const ordered = Object.entries(weights)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);
  const primary = ordered[0] || 'STR';
  const secondary = ordered[1] || 'INT';
  if (copy[primary] > 1 && copy[secondary] === 0) {
    copy[primary] -= 1;
    copy[secondary] += 1;
  } else if (copy[primary] > 2 && copy[secondary] > 0) {
    copy[primary] -= 1;
    copy[secondary] += 1;
  }
  return copy;
};

const effectTemplate = (axis, hex, ring) => {
  const pool = NODE_EFFECTS[axis] || NODE_EFFECTS.HYBRID;
  const index = Math.abs((hex.q * 17 + hex.r * 31 + ring * 7) % pool.length);
  return pool[index];
};

const notableTemplate = (axis, hex, ring) => {
  const pool = NOTABLES[axis] || NOTABLES.HYBRID;
  const index = Math.abs((hex.q * 11 + hex.r * 19 + ring * 5) % pool.length);
  return pool[index];
};

const keystoneTemplate = (axis, hex, ring) => {
  // Outer-ring keystones draw from the Signs; inner keystones stay axis-flavored.
  // Index by position around the ring so each sign seat gets a distinct Sign.
  if (ring >= 8) {
    const seat = Math.floor(hexRingIndex(hex, ring) / 8);
    return VERDIGRIS_SIGNS[Math.abs(seat) % VERDIGRIS_SIGNS.length];
  }
  const pool = KEYSTONES[axis] || KEYSTONES.HYBRID;
  const index = Math.abs((hex.q * 13 + hex.r * 23 + ring * 3) % pool.length);
  return pool[index];
};

const masteryTemplate = (axis, ring = 0) => {
  if (ring >= 7) return GRAND_MASTERIES[axis] || GRAND_MASTERIES.HYBRID;
  return MASTERIES[axis] || MASTERIES.HYBRID;
};

const makeNodeName = (template, hex, ring, type) => {
  if (type === 'small') {
    const pool = template.names;
    const index = Math.abs((hex.q * 7 + hex.r * 5 + ring * 3) % pool.length);
    return pool[index];
  }
  return template.name;
};

export const nodeRadius = (node, empowered = false) => {
  const base = {
    origin: 14,
    small: 7,
    notable: 12,
    mastery: 11,
    gateway: 13,
    keystone: 16,
  }[node.type] || 8;
  return empowered ? base + 3 : base;
};

class SkillNode {
  constructor({
    id, hex, pos, ring, type, axis, weights, name, effects, tags,
    stat = null, amount = 0, subtree = null, source = 'main',
  }) {
    this.id = id;
    this.hex = hex;
    this.pos = pos;
    this.ring = ring;
    this.type = type;
    this.axis = axis;
    this.weights = weights;
    this.name = name;
    this.effects = effects;
    this.tags = tags;
    this.stat = stat;
    this.amount = amount;
    this.subtree = subtree;
    this.source = source;
    this.cost = nodeCost(type);
    this.active = type === 'origin';
    this.connections = [];
  }
}

const createMainNode = (hex) => {
  const ring = hexDistance(hex);
  const pos = toPixel(hex);
  const weights = axisWeightsFromPosition(pos);
  const axis = ring === 0 ? 'HYBRID' : dominantAxis(weights);
  const type = nodeTypeFor(hex, ring);

  if (type === 'origin') {
    return new SkillNode({
      id: axialKey(hex.q, hex.r),
      hex,
      pos,
      ring,
      type,
      axis,
      weights,
      name: 'Origin',
      effects: ['Starting point. No passive bonus.'],
      tags: ['HYB', 'origin'],
    });
  }

  const template = type === 'keystone'
    ? keystoneTemplate(axis, hex, ring)
    : type === 'notable'
      ? notableTemplate(axis, hex, ring)
      : type === 'mastery'
        ? masteryTemplate(axis, ring)
        : effectTemplate(axis, hex, ring);
  const name = makeNodeName(template, hex, ring, type);
  const effects = ['keystone', 'notable', 'mastery'].includes(type)
    ? template.lines.slice()
    : [template.line];
  const stat = type === 'keystone' ? null : template.stat || null;
  const amount = type === 'keystone' ? 0 : template.amount || 0;
  const tags = [VERDIGRIS_AXIS_META[axis].short, type];
  if (template.tag) tags.push(template.tag);
  if (ring === 8 && type === 'keystone') tags.push('sign');
  if (ring === TREE_LAYERS) tags.push('outer');

  return new SkillNode({
    id: axialKey(hex.q, hex.r),
    hex,
    pos,
    ring,
    type,
    axis,
    weights,
    name,
    effects,
    tags,
    stat,
    amount,
  });
};

class Conduit {
  constructor(nodeA, nodeB, extra = false) {
    this.id = edgeKey(nodeA.id, nodeB.id);
    this.fromId = nodeA.id;
    this.toId = nodeB.id;
    this.extra = extra;
    this.ring = Math.max(nodeA.ring || 0, nodeB.ring || 0);
    this.depth = clamp((this.ring || 0) / TREE_LAYERS, 0, 1);
    this.allocatedVariant = null;
    this.options = [-1, 1].map(side => this.makeOption(nodeA, nodeB, side));
  }

  get allocated() {
    return Boolean(this.allocatedVariant);
  }

  get activeOption() {
    return this.getOption(this.allocatedVariant);
  }

  get attrs() {
    return this.activeOption ? this.activeOption.attrs : { STR: 0, DEX: 0, INT: 0 };
  }

  getOption(optionId) {
    return this.options.find(option => option.id === optionId) || null;
  }

  makeOption(nodeA, nodeB, side) {
    const sideName = side < 0 ? 'inner' : 'outer';
    const dx = nodeB.pos.x - nodeA.pos.x;
    const dy = nodeB.pos.y - nodeA.pos.y;
    const length = Math.hypot(dx, dy) || 1;
    const offset = side * Math.min(42, Math.max(20, length * 0.34));
    const midpoint = {
      x: (nodeA.pos.x + nodeB.pos.x) / 2,
      y: (nodeA.pos.y + nodeB.pos.y) / 2,
    };
    const sample = {
      x: midpoint.x + (-dy / length) * offset,
      y: midpoint.y + (dx / length) * offset,
    };
    const weights = axisWeightsFromPosition(sample);
    const axis = dominantAxis(weights);
    const attrs = biasArcAttributes(pathAttributesFromWeights(weights, Math.max(nodeA.ring, nodeB.ring)), weights);
    const secondary = Object.entries(attrs)
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key)
      .slice(0, 2)
      .join('/');

    return {
      id: sideName,
      side,
      axis,
      weights,
      attrs,
      color: axisColor(axis),
      name: `${side < 0 ? 'Inner' : 'Outer'} ${axis === 'HYBRID' ? VERDIGRIS_AXIS_META.HYBRID.path : VERDIGRIS_AXIS_META[axis].path}`,
      short: secondary || VERDIGRIS_AXIS_META[axis].short,
    };
  }
}

export class VerdigrisGeometricTree {
  // availablePoints is the current earned pool (1 per level after 1, plus
  // quest points). A fresh level-1 character starts with 0; the 123 constant
  // in VERDIGRIS_SKILL_TREE_POINTS is only the lifetime cap shown in the UI.
  constructor({ availablePoints = 0 } = {}) {
    this.initialPoints = Math.max(0, Math.floor(availablePoints));
    this.nodes = new Map();
    this.conduits = new Map();
    this.points = { skill: this.initialPoints };
    this.pending = null;
    this.selectedNodeId = '0,0';
    this.history = [];
    this.log = [];
    this.searchTerm = '';
    this.empoweredNodes = new Set();
    this.empoweredNodeDetails = new Map();
    this.shapeBonuses = [];
    this.lastDeltas = [];
    this.stats = null;
    this.generateTree(TREE_LAYERS);
    this.buildSubtrees();
    this.recalculate();
  }

  generateTree(layers) {
    this.addNode({ q: 0, r: 0 });
    for (let layer = 1; layer <= layers; layer += 1) {
      let cursor = { q: 0, r: 0 };
      for (let k = 0; k < layer; k += 1) cursor = neighbor(cursor, 4);
      for (let side = 0; side < 6; side += 1) {
        for (let step = 0; step < layer; step += 1) {
          this.addNode(cursor);
          this.connectNeighbors(cursor);
          cursor = neighbor(cursor, side);
        }
      }
    }
  }

  buildSubtrees() {
    VERDIGRIS_SUBTREES.forEach((config) => {
      const gatewayId = axialKey(config.gateway.q, config.gateway.r);
      const gateway = this.nodes.get(gatewayId);
      if (!gateway) return;
      gateway.type = 'gateway';
      gateway.cost = nodeCost('gateway');
      gateway.name = `${config.title} Gate`;
      gateway.tags = Array.from(new Set([...gateway.tags, 'gateway', config.title]));
      gateway.effects = [
        `Shared gate for the ${config.title} outer circle.`,
        'Unlock condition: allocate this gate and complete any inner six-node circle.',
      ];
      gateway.stat = null;
      gateway.amount = 0;

      const outward = normalizeVector(gateway.pos);
      const tangent = { x: -outward.y, y: outward.x };
      const base = {
        x: gateway.pos.x + outward.x * 292,
        y: gateway.pos.y + outward.y * 292,
      };

      const created = [];
      config.nodes.forEach((def, index) => {
        const local = config.layout[index] || [0, index * SUBTREE_SPACING];
        const pos = {
          x: base.x + tangent.x * local[0] + outward.x * local[1],
          y: base.y + tangent.y * local[0] + outward.y * local[1],
        };
        const weights = axisWeightsFromPosition(pos);
        const axis = def.tag === 'hybrid' ? 'HYBRID' : config.axis;
        const node = new SkillNode({
          id: def.id,
          hex: null,
          pos,
          ring: TREE_LAYERS + 1,
          type: def.type,
          axis,
          weights,
          name: def.name,
          effects: def.effects.slice(),
          tags: [VERDIGRIS_AXIS_META[axis].short, def.type, def.tag, config.title],
          stat: def.stat,
          amount: def.amount,
          subtree: config.id,
          source: 'subtree',
        });
        this.nodes.set(node.id, node);
        created.push(node);
      });

      this.addConduit(gateway, created[0]);
      config.links.forEach(([fromIndex, toIndex, extra]) => {
        this.addConduit(created[fromIndex], created[toIndex], Boolean(extra));
      });
    });
  }

  addNode(hex) {
    const key = axialKey(hex.q, hex.r);
    if (!this.nodes.has(key)) this.nodes.set(key, createMainNode({ q: hex.q, r: hex.r }));
  }

  connectNeighbors(hex) {
    for (let i = 0; i < 6; i += 1) {
      const nHex = neighbor(hex, i);
      const key = axialKey(hex.q, hex.r);
      const nKey = axialKey(nHex.q, nHex.r);
      if (this.nodes.has(nKey)) this.addConduit(this.nodes.get(key), this.nodes.get(nKey));
    }
  }

  addConduit(nodeA, nodeB, extra = false) {
    const id = edgeKey(nodeA.id, nodeB.id);
    if (this.conduits.has(id)) return this.conduits.get(id);
    const conduit = new Conduit(nodeA, nodeB, extra);
    this.conduits.set(id, conduit);
    if (!nodeA.connections.includes(nodeB.id)) nodeA.connections.push(nodeB.id);
    if (!nodeB.connections.includes(nodeA.id)) nodeB.connections.push(nodeA.id);
    return conduit;
  }

  isSubtreeUnlocked(subtreeId) {
    if (!subtreeId) return true;
    const config = VERDIGRIS_SUBTREES.find(entry => entry.id === subtreeId);
    if (!config) return false;
    const gateway = this.nodes.get(axialKey(config.gateway.q, config.gateway.r));
    return Boolean(gateway?.active && this.empoweredNodes.size > 0);
  }

  isNodeVisible(node) {
    return node.source !== 'subtree' || this.isSubtreeUnlocked(node.subtree);
  }

  isConduitVisible(conduit) {
    const fromNode = this.nodes.get(conduit.fromId);
    const toNode = this.nodes.get(conduit.toId);
    return Boolean(fromNode && toNode && this.isNodeVisible(fromNode) && this.isNodeVisible(toNode));
  }

  snapshot() {
    return {
      nodes: Array.from(this.nodes.values()).filter(node => node.active).map(node => node.id),
      conduits: Array.from(this.conduits.values())
        .filter(conduit => conduit.allocated)
        .map(conduit => ({ id: conduit.id, variant: conduit.allocatedVariant })),
      points: { ...this.points },
      log: this.log.slice(),
      selectedNodeId: this.selectedNodeId,
    };
  }

  restore(snapshot) {
    this.nodes.forEach((node) => { node.active = snapshot.nodes.includes(node.id); });
    this.conduits.forEach((conduit) => {
      const saved = snapshot.conduits.find(item => item.id === conduit.id);
      conduit.allocatedVariant = saved ? saved.variant : null;
    });
    this.points = { ...snapshot.points };
    this.log = snapshot.log.slice();
    this.selectedNodeId = snapshot.selectedNodeId || '0,0';
    this.pending = null;
    this.recalculate();
  }

  saveHistory() {
    this.history.push(this.snapshot());
    this.history = this.history.slice(-32);
  }

  commit(message) {
    this.log.unshift(message);
    this.log = this.log.slice(0, 8);
  }

  reset() {
    this.saveHistory();
    this.nodes.forEach((node) => { node.active = node.id === '0,0'; });
    this.conduits.forEach((conduit) => { conduit.allocatedVariant = null; });
    this.points = { skill: this.initialPoints };
    this.pending = null;
    this.selectedNodeId = '0,0';
    this.log = ['Build reset to origin.'];
    this.recalculate();
  }

  // Reconcile the earned pool when the character levels up or gains quest
  // points: add the delta to whatever is currently unspent.
  setAvailablePoints(total) {
    const next = Math.max(0, Math.floor(total));
    const spent = this.initialPoints - this.points.skill;
    this.initialPoints = next;
    this.points = { skill: Math.max(0, next - Math.max(0, spent)) };
    this.recalculate();
  }

  undo() {
    const previous = this.history.pop();
    if (!previous) return false;
    this.restore(previous);
    return true;
  }

  setSearchTerm(term) {
    this.searchTerm = String(term || '').trim().toLowerCase();
  }

  choiceId(conduitId, optionId) {
    return `${conduitId}|${optionId}`;
  }

  parseChoiceId(choiceId) {
    const [conduitId, optionId] = choiceId.split('|');
    return { conduitId, optionId };
  }

  getActiveNeighborConduitChoices(node) {
    return node.connections
      .map((neighborId) => {
        const neighborNode = this.nodes.get(neighborId);
        const conduit = this.conduits.get(edgeKey(node.id, neighborId));
        return { neighbor: neighborNode, conduit };
      })
      .filter(item => item.neighbor && item.neighbor.active
        && item.conduit && !item.conduit.allocated && this.isConduitVisible(item.conduit))
      .flatMap(item => item.conduit.options.map(option => ({
        neighbor: item.neighbor,
        conduit: item.conduit,
        option,
        choiceId: this.choiceId(item.conduit.id, option.id),
      })));
  }

  scoreAllocationChoice(node, choice) {
    const weights = node.weights || { STR: 1 / 3, DEX: 1 / 3, INT: 1 / 3 };
    const attrs = choice.option.attrs;
    const weightedAttrs = attrs.STR * weights.STR + attrs.DEX * weights.DEX + attrs.INT * weights.INT;
    const axisBonus = node.axis !== 'HYBRID'
      ? (attrs[node.axis] || 0) * 0.18
      : Math.min(attrs.STR, attrs.DEX, attrs.INT) * 0.12;
    const inwardBonus = choice.neighbor ? Math.max(0, node.ring - choice.neighbor.ring) * 0.06 : 0;
    const extraPenalty = choice.conduit.extra ? -0.1 : 0;
    return weightedAttrs + axisBonus + inwardBonus + extraPenalty;
  }

  sortChoices(node, choices) {
    return choices.slice().sort((a, b) => {
      const scoreDiff = this.scoreAllocationChoice(node, b) - this.scoreAllocationChoice(node, a);
      if (Math.abs(scoreDiff) > 0.001) return scoreDiff;
      const ringDiff = (a.neighbor?.ring || 0) - (b.neighbor?.ring || 0);
      if (ringDiff) return ringDiff;
      const conduitDiff = a.conduit.id.localeCompare(b.conduit.id);
      if (conduitDiff) return conduitDiff;
      return a.option.id.localeCompare(b.option.id);
    });
  }

  isAvailableNode(node) {
    if (!node || node.active || !this.isNodeVisible(node)) return false;
    if (this.points.skill < node.cost + 1) return false;
    return this.getActiveNeighborConduitChoices(node).length > 0;
  }

  isAvailableConduit(conduit, optionId = null) {
    if (!conduit || conduit.allocated || !this.isConduitVisible(conduit)) return false;
    if (optionId && !conduit.getOption(optionId)) return false;
    const fromNode = this.nodes.get(conduit.fromId);
    const toNode = this.nodes.get(conduit.toId);
    if (!fromNode || !toNode) return false;
    if (fromNode.active && toNode.active) return this.points.skill >= 1;
    const target = fromNode.active ? toNode : toNode.active ? fromNode : null;
    return Boolean(target && this.points.skill >= target.cost + 1);
  }

  handleNodeClick(id) {
    const node = this.nodes.get(id);
    if (!node) return;
    this.selectedNodeId = id;
    if (this.pending?.mode === 'node' && this.pending.nodeId === id) {
      this.pending = null;
      this.recalculate();
      return;
    }
    if (this.pending) this.pending = null;
    if (node.active) {
      this.refundNode(id);
      return;
    }
    this.tryAllocateNode(id);
  }

  tryAllocateNode(id) {
    const node = this.nodes.get(id);
    if (!node) return;
    if (this.points.skill < node.cost + 1) {
      this.commit(`Not enough skill points for ${node.name} (needs ${node.cost + 1} with its path).`);
      this.recalculate();
      return;
    }
    const choices = this.sortChoices(node, this.getActiveNeighborConduitChoices(node));
    if (!choices.length) {
      this.commit(`${node.name} is not adjacent to an allocated node.`);
      this.recalculate();
      return;
    }
    if (choices.length === 1) {
      this.allocateNodeWithConduit(node, choices[0].conduit, choices[0].option.id);
      return;
    }
    this.pending = {
      mode: 'node',
      nodeId: node.id,
      choices: choices.map(choice => choice.choiceId),
    };
    this.recalculate();
  }

  allocateNodeWithConduit(node, conduit, optionId) {
    if (!node || !conduit || node.active || conduit.allocated) return;
    const option = conduit.getOption(optionId);
    if (!option) return;
    this.saveHistory();
    node.active = true;
    conduit.allocatedVariant = option.id;
    this.points.skill -= node.cost + 1;
    this.pending = null;
    this.selectedNodeId = node.id;
    this.commit(`Allocated ${node.name} through ${option.name} (${formatAttrs(option.attrs)}).`);
    this.recalculate();
  }

  handleConduitClick(id, optionId = null) {
    const conduit = this.conduits.get(id);
    if (!conduit) return;
    if (this.pending) {
      const pending = this.pending;
      const choiceId = this.choiceId(id, optionId);
      if (pending.mode === 'node' && pending.choices.includes(choiceId)) {
        this.allocateNodeWithConduit(this.nodes.get(pending.nodeId), conduit, optionId);
        return;
      }
      if (pending.mode === 'conduit' && pending.conduitId === id && pending.choices.includes(choiceId)) {
        this.changeConduitVariant(id, optionId);
        return;
      }
      return;
    }
    if (conduit.allocated) {
      if (optionId && optionId !== conduit.allocatedVariant) {
        this.changeConduitVariant(conduit.id, optionId);
      } else {
        this.openConduitEditor(conduit.id);
      }
      return;
    }
    if (this.isAvailableConduit(conduit, optionId)) {
      const option = conduit.getOption(optionId);
      if (!option) return;
      const fromNode = this.nodes.get(conduit.fromId);
      const toNode = this.nodes.get(conduit.toId);
      const target = fromNode.active ? toNode : toNode.active ? fromNode : null;
      if (target && !target.active) {
        this.allocateNodeWithConduit(target, conduit, option.id);
        return;
      }
      this.saveHistory();
      conduit.allocatedVariant = option.id;
      this.points.skill -= 1;
      this.commit(`Added loop conduit ${option.name} (${formatAttrs(option.attrs)}).`);
      this.recalculate();
    }
  }

  openConduitEditor(id) {
    const conduit = this.conduits.get(id);
    if (!conduit || !conduit.allocated) return;
    this.pending = {
      mode: 'conduit',
      conduitId: id,
      choices: conduit.options.map(option => this.choiceId(id, option.id)),
    };
    this.recalculate();
  }

  changeConduitVariant(id, optionId) {
    const conduit = this.conduits.get(id);
    const option = conduit?.getOption(optionId);
    if (!conduit || !option || !conduit.allocated) return;
    if (conduit.allocatedVariant === option.id) {
      this.pending = null;
      this.recalculate();
      return;
    }
    this.saveHistory();
    const previous = conduit.activeOption;
    conduit.allocatedVariant = option.id;
    this.pending = null;
    this.commit(`Changed ${previous ? previous.name : 'conduit'} to ${option.name} (${formatAttrs(option.attrs)}).`);
    this.recalculate();
  }

  refundNode(id) {
    const node = this.nodes.get(id);
    if (!node || node.id === '0,0' || !node.active) return;
    if (!this.canRefundNode(id)) {
      this.commit(`${node.name} supports another allocated path and cannot be refunded first.`);
      this.recalculate();
      return;
    }
    this.saveHistory();
    node.active = false;
    this.points.skill += node.cost;
    node.connections.forEach((neighborId) => {
      const conduit = this.conduits.get(edgeKey(node.id, neighborId));
      if (conduit && conduit.allocated) {
        conduit.allocatedVariant = null;
        this.points.skill += 1;
      }
    });
    this.selectedNodeId = '0,0';
    this.pending = null;
    this.commit(`Refunded ${node.name}.`);
    this.recalculate();
  }

  refundConduit(id) {
    const conduit = this.conduits.get(id);
    if (!conduit || !conduit.allocated) return;
    if (!this.canRefundConduit(id)) {
      this.commit('That conduit supports allocated nodes and cannot be removed first.');
      this.recalculate();
      return;
    }
    this.saveHistory();
    const option = conduit.activeOption;
    conduit.allocatedVariant = null;
    this.points.skill += 1;
    if (this.pending?.mode === 'conduit' && this.pending.conduitId === id) this.pending = null;
    this.commit(`Refunded ${option ? option.name : 'conduit'}.`);
    this.recalculate();
  }

  canRefundNode(id) {
    const remainingActive = Array.from(this.nodes.values())
      .filter(node => node.active && node.id !== id)
      .map(node => node.id);
    const reachable = this.reachableFromOrigin({ blockedNodeId: id });
    return remainingActive.every(nodeId => reachable.has(nodeId));
  }

  canRefundConduit(id) {
    const remainingActive = Array.from(this.nodes.values())
      .filter(node => node.active)
      .map(node => node.id);
    const reachable = this.reachableFromOrigin({ blockedConduitId: id });
    return remainingActive.every(nodeId => reachable.has(nodeId));
  }

  reachableFromOrigin({ blockedNodeId = null, blockedConduitId = null } = {}) {
    const visited = new Set(['0,0']);
    const queue = ['0,0'];
    while (queue.length) {
      const id = queue.shift();
      const node = this.nodes.get(id);
      if (!node) continue;
      node.connections.forEach((neighborId) => {
        if (neighborId === blockedNodeId || visited.has(neighborId)) return;
        const neighborNode = this.nodes.get(neighborId);
        const conduit = this.conduits.get(edgeKey(id, neighborId));
        if (conduit?.id === blockedConduitId) return;
        if (neighborNode && neighborNode.active && conduit && conduit.allocated) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      });
    }
    return visited;
  }

  recalculate() {
    const previousStats = this.stats || null;
    this.empoweredNodeDetails = this.detectLoopEmpowerments();
    this.empoweredNodes = new Set(this.empoweredNodeDetails.keys());
    this.shapeBonuses = this.computeShapeBonuses();
    this.stats = this.computeStats();
    this.lastDeltas = this.computeDeltas(previousStats, this.stats);
  }

  computeStats() {
    const attrs = { STR: 0, DEX: 0, INT: 0 };
    const derived = { ...BASE_CHARACTER };
    this.conduits.forEach((conduit) => {
      if (!conduit.allocated) return;
      attrs.STR += conduit.attrs.STR;
      attrs.DEX += conduit.attrs.DEX;
      attrs.INT += conduit.attrs.INT;
    });
    this.nodes.forEach((node) => {
      if (!node.active) return;
      if (node.stat && typeof node.amount === 'number') derived[node.stat] = (derived[node.stat] || 0) + node.amount;
      const boost = this.getNodeBoost(node);
      if (!boost) return;
      if (node.stat && boost.directBonus) derived[node.stat] = (derived[node.stat] || 0) + boost.directBonus;
      attrs.STR += boost.attrBonus.STR;
      attrs.DEX += boost.attrBonus.DEX;
      attrs.INT += boost.attrBonus.INT;
    });
    this.shapeBonuses.forEach((bonus) => {
      if (!bonus.active) return;
      Object.entries(bonus.attrs || {}).forEach(([key, value]) => { attrs[key] += value; });
      Object.entries(bonus.derived || {}).forEach(([key, value]) => { derived[key] = (derived[key] || 0) + value; });
    });
    derived.life += Math.round(attrs.STR * 7);
    derived.mana += Math.round(attrs.INT * 5);
    derived.armour += Math.round(attrs.STR * 8);
    derived.evasion += Math.round(attrs.DEX * 8);
    derived.energyShield += Math.round(attrs.INT * 6);
    derived.attackDamage += Math.round(attrs.STR * 0.55 + attrs.DEX * 0.35);
    derived.spellDamage += Math.round(attrs.INT * 0.7);
    derived.projectileDamage += Math.round(attrs.DEX * 0.55);
    derived.minionDamage += Math.round(attrs.INT * 0.42);
    derived.attackSpeed += round(attrs.DEX * 0.08 + attrs.STR * 0.03);
    derived.castSpeed += round(attrs.INT * 0.08 + attrs.DEX * 0.02);
    derived.critChance = round(derived.critChance + attrs.DEX * 0.035 + attrs.INT * 0.025);
    derived.allResistances = round(derived.allResistances + attrs.INT * 0.05 + attrs.STR * 0.025);
    derived.blockChance = round(Math.min(75, derived.blockChance + attrs.STR * 0.015));
    return { attrs, derived };
  }

  computeDeltas(previous, next) {
    if (!previous) {
      return ['Allocate nodes for passive effects.', 'Allocate conduits for STR, DEX, and INT.', 'Closed loops empower their center.'];
    }
    const deltas = [];
    ['STR', 'DEX', 'INT'].forEach((key) => {
      const diff = next.attrs[key] - previous.attrs[key];
      if (diff) deltas.push(`${diff > 0 ? '+' : ''}${diff} ${key} from conduit changes.`);
    });
    Object.entries(next.derived).forEach(([key, value]) => {
      const diff = value - previous.derived[key];
      if (diff) deltas.push(`${diff > 0 ? '+' : ''}${formatNumber(diff)}${statSuffix(key)} ${formatDerivedLabel(key)}.`);
    });
    return deltas.slice(0, 5);
  }

  getNodeBoost(node) {
    const detail = this.empoweredNodeDetails.get(node.id);
    if (!detail) return null;
    const radiusTotal = detail.radiusTotal;
    const loopCount = detail.loops.length;
    const maxRadius = detail.maxRadius;
    const multiplier = round(1 + radiusTotal * 0.42 + Math.max(0, maxRadius - 1) * 0.16 + Math.max(0, loopCount - 1) * 0.12);
    const percentIncrease = Math.round((multiplier - 1) * 100);
    const directBonus = node.stat && typeof node.amount === 'number' ? round(node.amount * (multiplier - 1)) : 0;
    const attrScale = 4 + maxRadius * 3 + radiusTotal + Math.max(0, loopCount - 1) * 2;
    const attrBonus = {
      STR: Math.round(node.weights.STR * attrScale),
      DEX: Math.round(node.weights.DEX * attrScale),
      INT: Math.round(node.weights.INT * attrScale),
    };
    const primaryAttr = Object.entries(node.weights).sort((a, b) => b[1] - a[1])[0][0];
    if (attrBonus[primaryAttr] < 1) attrBonus[primaryAttr] = 1;
    return { ...detail, loopCount, multiplier, percentIncrease, directBonus, attrBonus };
  }

  formatNodeBoostLines(node) {
    const boost = this.getNodeBoost(node);
    if (!boost) return [];
    const loopLabels = boost.loops.map(loop => (loop.radius === 1 ? 'inner loop' : `radius ${loop.radius} loop`));
    const lines = [
      `${boost.loopCount} completed loop${boost.loopCount === 1 ? '' : 's'} (${loopLabels.join(', ')}).`,
      `${boost.percentIncrease}% increased center-node effect.`,
    ];
    if (node.stat && boost.directBonus) lines.push(`+${formatNumber(boost.directBonus)}${statSuffix(node.stat)} ${formatDerivedLabel(node.stat)}.`);
    lines.push(`${formatAttrs(boost.attrBonus)} from the closed loop.`);
    return lines;
  }

  hexRingNodes(center, radius) {
    if (!center || !center.hex || radius < 1) return null;
    const nodes = [];
    let q = center.hex.q + HEX_DIRECTIONS[4].q * radius;
    let r = center.hex.r + HEX_DIRECTIONS[4].r * radius;
    for (let side = 0; side < 6; side += 1) {
      const dir = HEX_DIRECTIONS[side];
      for (let step = 0; step < radius; step += 1) {
        const node = this.nodes.get(axialKey(q, r));
        if (!node) return null;
        nodes.push(node);
        q += dir.q;
        r += dir.r;
      }
    }
    return nodes;
  }

  detectCompletedLoop(center, radius) {
    const ringNodes = this.hexRingNodes(center, radius);
    if (!ringNodes || ringNodes.some(node => !node.active || node.source !== 'main')) return null;
    const perimeterComplete = ringNodes.every((node, index) => {
      const next = ringNodes[(index + 1) % ringNodes.length];
      const conduit = this.conduits.get(edgeKey(node.id, next.id));
      return conduit && conduit.allocated;
    });
    if (!perimeterComplete) return null;
    return { radius, nodeIds: ringNodes.map(node => node.id) };
  }

  detectLoopEmpowerments() {
    const details = new Map();
    this.nodes.forEach((node) => {
      if (!node.active || node.source !== 'main' || node.ring === 0) return;
      const loops = [];
      for (let radius = 1; radius <= 3; radius += 1) {
        const loop = this.detectCompletedLoop(node, radius);
        if (loop) loops.push(loop);
      }
      if (!loops.length) return;
      details.set(node.id, {
        nodeId: node.id,
        loops,
        maxRadius: Math.max(...loops.map(loop => loop.radius)),
        radiusTotal: loops.reduce((sum, loop) => sum + loop.radius, 0),
      });
    });
    return details;
  }

  computeShapeBonuses() {
    const loopDetails = Array.from(this.empoweredNodeDetails.values());
    const loopTotals = { 1: 0, 2: 0, 3: 0 };
    loopDetails.forEach((detail) => {
      detail.loops.forEach((loop) => { loopTotals[loop.radius] += 1; });
    });
    const activeCircles = loopTotals[1] + loopTotals[2] + loopTotals[3];
    const largeLoops = loopTotals[2] + loopTotals[3];
    const loopPower = loopTotals[1] + loopTotals[2] * 2 + loopTotals[3] * 3;
    const axisChains = this.computeAxisChains();
    const symmetryPairs = this.computeSymmetryPairs();
    const loopCount = this.computeExtraLoopCount();
    return [
      {
        id: 'circle',
        name: 'Loop Crowns',
        active: activeCircles > 0,
        progress: `${loopDetails.length} center${loopDetails.length === 1 ? '' : 's'} crowned; ${largeLoops} large loop${largeLoops === 1 ? '' : 's'}`,
        description: 'Closed hex loops empower their center; larger loops resonate harder.',
        attrs: { STR: loopPower * 3, DEX: loopPower * 3, INT: loopPower * 3 },
        derived: {
          spellDamage: loopPower * 9 + largeLoops * 8,
          energyShield: loopPower * 42 + largeLoops * 34,
          armour: loopPower * 42 + largeLoops * 34,
        },
      },
      {
        id: 'axis',
        name: 'Straight Axis Chain',
        active: Object.values(axisChains).some(length => length >= 4),
        progress: `INT ${axisChains.INT}, DEX ${axisChains.DEX}, STR ${axisChains.STR}`,
        description: 'Four or more segments along an attribute axis.',
        attrs: {
          INT: axisChains.INT >= 4 ? axisChains.INT * 2 : 0,
          DEX: axisChains.DEX >= 4 ? axisChains.DEX * 2 : 0,
          STR: axisChains.STR >= 4 ? axisChains.STR * 2 : 0,
        },
        derived: {
          spellDamage: axisChains.INT >= 4 ? 14 : 0,
          projectileDamage: axisChains.DEX >= 4 ? 14 : 0,
          attackDamage: axisChains.STR >= 4 ? 14 : 0,
        },
      },
      {
        id: 'mirror',
        name: 'Mirror Symmetry',
        active: symmetryPairs >= 5,
        progress: `${symmetryPairs} mirrored pairs`,
        description: 'Allocate matching left/right nodes across the vertical INT axis.',
        attrs: symmetryPairs >= 5 ? { STR: 8, DEX: 8, INT: 8 } : {},
        derived: symmetryPairs >= 5 ? { allResistances: 6, cooldownRecovery: 8 } : {},
      },
      {
        id: 'loop',
        name: 'Redundant Circuit',
        active: loopCount >= 3,
        progress: `${loopCount} redundant conduit${loopCount === 1 ? '' : 's'}`,
        description: 'Extra active-to-active links create redundant routes.',
        attrs: loopCount >= 3 ? { DEX: loopCount, INT: loopCount } : {},
        derived: loopCount >= 3 ? { energyShield: loopCount * 18, evasion: loopCount * 18 } : {},
      },
    ];
  }

  computeAxisChains() {
    const result = {};
    Object.entries(AXIS_DIRECTIONS).forEach(([axis, dir]) => {
      let length = 0;
      let currentId = '0,0';
      for (let step = 1; step <= TREE_LAYERS; step += 1) {
        const nextId = axialKey(dir.q * step, dir.r * step);
        const node = this.nodes.get(nextId);
        const conduit = this.conduits.get(edgeKey(currentId, nextId));
        if (node && node.active && conduit && conduit.allocated) {
          length += 1;
          currentId = nextId;
        } else {
          break;
        }
      }
      result[axis] = length;
    });
    return result;
  }

  computeSymmetryPairs() {
    let pairs = 0;
    this.nodes.forEach((node) => {
      if (!node.active || node.source !== 'main' || !node.hex || node.hex.q >= 0) return;
      const mirror = this.nodes.get(axialKey(-node.hex.q - node.hex.r, node.hex.r));
      if (mirror && mirror.active) pairs += 1;
    });
    return pairs;
  }

  computeExtraLoopCount() {
    let count = 0;
    this.conduits.forEach((conduit) => {
      if (!conduit.allocated) return;
      const fromNode = this.nodes.get(conduit.fromId);
      const toNode = this.nodes.get(conduit.toId);
      if (fromNode && toNode && fromNode.active && toNode.active && this.hasAlternateActiveRoute(conduit)) count += 1;
    });
    return count;
  }

  hasAlternateActiveRoute(blockedConduit) {
    const target = blockedConduit.toId;
    const visited = new Set([blockedConduit.fromId]);
    const queue = [blockedConduit.fromId];
    while (queue.length) {
      const id = queue.shift();
      const node = this.nodes.get(id);
      if (!node) continue;
      for (const neighborId of node.connections) {
        const conduit = this.conduits.get(edgeKey(id, neighborId));
        if (!conduit || !conduit.allocated || conduit.id === blockedConduit.id || visited.has(neighborId)) continue;
        const neighborNode = this.nodes.get(neighborId);
        if (!neighborNode || !neighborNode.active) continue;
        if (neighborId === target) return true;
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }
    return false;
  }

  getPendingChoices() {
    if (!this.pending) return [];
    if (this.pending.mode === 'node') {
      const pendingNode = this.nodes.get(this.pending.nodeId);
      return this.pending.choices.map((choiceId) => {
        const { conduitId, optionId } = this.parseChoiceId(choiceId);
        const conduit = this.conduits.get(conduitId);
        const option = conduit?.getOption(optionId);
        const otherId = conduit?.fromId === pendingNode?.id ? conduit.toId : conduit?.fromId;
        const other = this.nodes.get(otherId);
        return {
          choiceId,
          conduitId,
          optionId,
          title: `${option?.name || 'Conduit'} from ${other?.name || 'route'}`,
          meta: option ? formatAttrs(option.attrs) : '',
          current: false,
        };
      });
    }
    if (this.pending.mode === 'conduit') {
      const conduit = this.conduits.get(this.pending.conduitId);
      return this.pending.choices.map((choiceId) => {
        const { conduitId, optionId } = this.parseChoiceId(choiceId);
        const option = conduit?.getOption(optionId);
        return {
          choiceId,
          conduitId,
          optionId,
          title: `${conduit?.allocatedVariant === optionId ? 'Current' : 'Switch'} ${option?.name || 'Conduit'}`,
          meta: option ? formatAttrs(option.attrs) : '',
          current: conduit?.allocatedVariant === optionId,
        };
      });
    }
    return [];
  }

  nodeView(node) {
    const boostLines = this.formatNodeBoostLines(node);
    return {
      id: node.id,
      name: node.name,
      type: node.type,
      axis: node.axis,
      axisLabel: VERDIGRIS_AXIS_META[node.axis]?.label || 'Hybrid',
      cost: node.cost,
      ring: node.ring,
      active: node.active,
      effects: node.effects.slice(),
      tags: node.tags.slice(),
      boostLines,
      canRefund: node.active && node.id !== '0,0' && this.canRefundNode(node.id),
    };
  }

  toState() {
    const selectedNode = this.nodes.get(this.selectedNodeId) || this.nodes.get('0,0');
    return {
      points: { ...this.points },
      stats: {
        attrs: { ...this.stats.attrs },
        derived: { ...this.stats.derived },
      },
      selectedNode: this.nodeView(selectedNode),
      shapeBonuses: this.shapeBonuses.map(bonus => ({ ...bonus })),
      log: this.log.slice(),
      lastDeltas: this.lastDeltas.slice(),
      pending: this.pending ? { ...this.pending, choices: this.pending.choices.slice() } : null,
      pendingChoices: this.getPendingChoices(),
      activeNodes: Array.from(this.nodes.values()).filter(node => node.active).length,
      allocatedConduits: Array.from(this.conduits.values()).filter(conduit => conduit.allocated).length,
      searchTerm: this.searchTerm,
    };
  }
}

export const createDerivedRows = derived => Object.entries(VERDIGRIS_DERIVED_LABELS).map(([key, [label]]) => ({
  key,
  label,
  value: formatDerivedValue(key, derived[key] || 0),
}));

export default VerdigrisGeometricTree;
