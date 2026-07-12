import {
  VERDIGRIS_SKILL_TREE_TOTALS,
} from './verdigris-skill-tree.js';
import AUTHORED_TREE_DATA from './verdigris-authored-tree-data.js';

export const VERDIGRIS_PASSIVE_TREE_SCHEMA_VERSION = 2;

export const VERDIGRIS_CLASS_UNLOCKS = Object.freeze({
  Champion: ['tower_shield', 'war_horn_curio', 'war_call_slot'],
  Acrobat: ['second_weapon_set', 'dual_wield_one_handers', 'quick_rig_slot'],
  Archmage: ['second_curio', 'rite_focus_socket', 'attendant_focus_slot'],
  Reaver: ['thrown_melee_projectile', 'belt_fetish', 'spoils_pack'],
  Nightblade: ['trap_mark_tools', 'venom_vials', 'preparations_pack'],
  Ritualist: ['banners', 'war_companion', 'reliquary_pack'],
});

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
const AUTHORED_SEATS = AUTHORED_TREE_DATA.seats || {};
const STAT_ALIASES = Object.freeze({
  accuracy_flat: 'projectileDamage',
  crit_bonus_flat: 'critChance',
  ember_res: 'allResistances',
  emberkiss: 'spellDamage',
  evasion_increased: 'evasion',
  gloam_res: 'allResistances',
  guard: 'armour',
  guard_increased: 'armour',
  heavy: 'attackDamage',
  physical_increased: 'attackDamage',
  reach_increased: 'attackDamage',
  river_resistance: 'allResistances',
  spirit: 'mana',
  storm_res: 'allResistances',
  ward: 'energyShield',
  ward_pct: 'energyShield',
});
const ATTRIBUTE_STATS = Object.freeze({ str: 'STR', dex: 'DEX', int: 'INT' });

const canonicalStat = stat => STAT_ALIASES[stat] || stat;
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
  STR: { q: -1, r: 1 },
  DEX: { q: 0, r: -1 },
  INT: { q: 1, r: 0 },
};

export const VERDIGRIS_SIGNS = Object.freeze(Object.values(AUTHORED_SEATS)
  .filter(seat => seat.type === 'sign')
  .map(seat => ({ name: seat.name, lines: seat.effects.slice() })));

// Gateway annexes hang off the six ring-9 corners. Axis gateways sit on the
// game's axis directions (STR q+, DEX -q+r, INT -r); hybrid annexes take the
// corners between them.
export const VERDIGRIS_SUBTREES = [
  {
    id: 'vanguard',
    title: 'Vanguard Oath',
    gateway: { q: -10, r: 10 },
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
    gateway: { q: 0, r: -10 },
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
    gateway: { q: 10, r: 0 },
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
    gateway: { q: 10, r: -10 },
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
    gateway: { q: -10, r: 0 },
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
    gateway: { q: 0, r: 10 },
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

// Rotate the axial lattice so the authored WIZARD axes read INT up, DEX
// bottom-left, and STR bottom-right.
const toPixel = (hex) => {
  const rawX = RADIUS * (hex.q + hex.r / 2);
  const rawY = RADIUS * (hex.r * Math.sqrt(3) / 2);
  return { x: rawY, y: -rawX };
};

const neighbor = (hex, i) => {
  const d = HEX_DIRECTIONS[i % 6];
  return { q: hex.q + d.q, r: hex.r + d.r };
};

const normalizeVector = (vector) => {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
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

export const nodeRadius = (node, empowered = false) => {
  const base = {
    origin: 14,
    small: 7,
    notable: 12,
    mastery: 11,
    waystone: 12,
    socket: 10,
    class: 14,
    sign: 16,
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
  const id = axialKey(hex.q, hex.r);
  const ring = hexDistance(hex);
  const pos = toPixel(hex);
  const weights = axisWeightsFromPosition(pos);
  const seat = AUTHORED_SEATS[id];
  const authoredAxis = String(seat?.axis || '').toUpperCase();
  const axis = VERDIGRIS_AXIS_META[authoredAxis]
    ? authoredAxis
    : ring === 0 ? 'HYBRID' : dominantAxis(weights);
  const type = seat?.type || (ring === 0 ? 'origin' : 'small');
  const effects = Array.isArray(seat?.effects) && seat.effects.length
    ? seat.effects.slice()
    : [ring === 0 ? 'Starting point. No passive bonus.' : 'This seat has no authored entry yet.'];
  const tags = Array.from(new Set([
    VERDIGRIS_AXIS_META[axis].short,
    type,
    ...(Array.isArray(seat?.tags) ? seat.tags : []),
  ]));
  if (ring === TREE_LAYERS) tags.push('outer');

  const node = new SkillNode({
    id,
    hex,
    pos,
    ring,
    type,
    axis,
    weights,
    name: seat?.name || (ring === 0 ? 'Origin' : `Unauthored Seat ${id}`),
    effects,
    tags,
    stat: type === 'origin' ? null : canonicalStat(seat?.stat || null),
    amount: type === 'origin' || !Number.isFinite(seat?.amount) ? 0 : seat.amount,
  });
  node.seat = seat || null;
  node.status = seat?.status || 'empty';
  node.notes = seat?.notes || '';
  node.clusterId = seat?.clusterId || '';
  return node;
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
  // quest points). A fresh level-1 character starts with 0; the 140 constant
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
    this.classOrder = [];
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
      schemaVersion: VERDIGRIS_PASSIVE_TREE_SCHEMA_VERSION,
      nodes: Array.from(this.nodes.values()).filter(node => node.active).map(node => node.id),
      conduits: Array.from(this.conduits.values())
        .filter(conduit => conduit.allocated)
        .map(conduit => ({ id: conduit.id, variant: conduit.allocatedVariant })),
      points: { ...this.points },
      log: this.log.slice(),
      selectedNodeId: this.selectedNodeId,
      classOrder: this.classOrder.slice(),
    };
  }

  restore(snapshot) {
    this.nodes.forEach((node) => { node.active = snapshot.nodes.includes(node.id); });
    this.conduits.forEach((conduit) => {
      const saved = snapshot.conduits.find(item => item.id === conduit.id);
      conduit.allocatedVariant = saved ? saved.variant : null;
    });
    this.points = { ...(snapshot.points || { skill: this.initialPoints }) };
    this.log = Array.isArray(snapshot.log) ? snapshot.log.slice() : [];
    this.selectedNodeId = snapshot.selectedNodeId || '0,0';
    const activeClasses = new Set(Array.from(this.nodes.values())
      .filter(node => node.active && node.type === 'class')
      .map(node => node.id));
    const savedOrder = Array.isArray(snapshot.classOrder) ? snapshot.classOrder : [];
    this.classOrder = [
      ...savedOrder.filter(id => activeClasses.has(id)),
      ...Array.from(activeClasses).filter(id => !savedOrder.includes(id)),
    ];
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
    this.classOrder = [];
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
    if (node.type === 'sign' && Array.from(this.nodes.values()).some(entry => entry.active && entry.type === 'sign')) {
      this.commit('Only one Sign may mark a life.');
      this.recalculate();
      return;
    }
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
    if (node.type === 'class' && !this.classOrder.includes(node.id)) this.classOrder.push(node.id);
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
    if (node.type === 'class') this.classOrder = this.classOrder.filter(nodeId => nodeId !== node.id);
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

  characterClassNode() {
    const firstId = this.classOrder.find(id => this.nodes.get(id)?.active);
    return firstId ? this.nodes.get(firstId) : null;
  }

  getUnlocks() {
    return [...new Set(this.classOrder
      .map(id => this.nodes.get(id))
      .filter(node => node?.active)
      .flatMap(node => VERDIGRIS_CLASS_UNLOCKS[node.name] || []))];
  }

  computeStats() {
    const attrs = { STR: 0, DEX: 0, INT: 0 };
    const derived = { ...BASE_CHARACTER };
    const applyAmount = (stat, amount) => {
      if (!stat || !Number.isFinite(amount)) return;
      if (ATTRIBUTE_STATS[stat]) {
        attrs[ATTRIBUTE_STATS[stat]] += amount;
      } else if (stat === 'attrs') {
        attrs.STR += amount;
        attrs.DEX += amount;
        attrs.INT += amount;
      } else {
        derived[stat] = (derived[stat] || 0) + amount;
      }
    };
    this.conduits.forEach((conduit) => {
      if (!conduit.allocated) return;
      attrs.STR += conduit.attrs.STR;
      attrs.DEX += conduit.attrs.DEX;
      attrs.INT += conduit.attrs.INT;
    });
    this.nodes.forEach((node) => {
      if (!node.active) return;
      applyAmount(node.stat, node.amount);
      const boost = this.getNodeBoost(node);
      if (!boost) return;
      applyAmount(node.stat, boost.directBonus);
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
    return {
      attrs,
      derived,
      characterClass: this.characterClassNode()?.name || null,
      unlocks: this.getUnlocks(),
    };
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
        characterClass: this.stats.characterClass,
        unlocks: this.stats.unlocks.slice(),
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
