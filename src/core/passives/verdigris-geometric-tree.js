import skillTreeContent from '@/assets/passives/skilltree-content.json';
import {
  VERDIGRIS_SKILL_TREE_POINTS,
  VERDIGRIS_SKILL_TREE_TOTALS,
} from '@/core/passives/verdigris-skill-tree.js';

export const VERDIGRIS_AXIS_META = Object.freeze({
  STR: { label: 'Strength', short: 'STR', color: '#b85b43', path: 'Iron Route' },
  DEX: { label: 'Dexterity', short: 'DEX', color: '#6aa86f', path: 'Quickstep Trace' },
  INT: { label: 'Intellect', short: 'INT', color: '#5f83d6', path: 'Memory Thread' },
  HYBRID: { label: 'Hybrid', short: 'HYB', color: '#c8aa66', path: 'Braided Span' },
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
const TREE_LAYERS = VERDIGRIS_SKILL_TREE_TOTALS.layers;
const KEYSTONE_ENTRIES = Object.values(skillTreeContent.keystones || {});
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
  life: 100,
  mana: 50,
  armour: 0,
  evasion: 0,
  energyShield: 0,
  attackDamage: 0,
  spellDamage: 0,
  projectileDamage: 0,
  minionDamage: 0,
  attackSpeed: 0,
  castSpeed: 0,
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

const NODE_STAT_ROTATION = {
  STR: [
    ['attackDamage', 'melee damage'],
    ['armour', 'armour'],
    ['life', 'maximum Life'],
    ['blockChance', 'Block Chance'],
  ],
  DEX: [
    ['attackSpeed', 'Attack Speed'],
    ['evasion', 'Evasion Rating'],
    ['projectileDamage', 'Projectile Damage'],
    ['critChance', 'Critical Strike Chance'],
  ],
  INT: [
    ['spellDamage', 'Spell Damage'],
    ['mana', 'maximum Mana'],
    ['energyShield', 'Ward'],
    ['castSpeed', 'Cast Speed'],
  ],
  HYBRID: [
    ['allResistances', 'all Resistances'],
    ['cooldownRecovery', 'Cooldown Recovery'],
    ['ailmentEffect', 'Ailment Effect'],
    ['spellDamage', 'mixed damage'],
  ],
};

const NODE_TYPE_MULTIPLIER = {
  origin: 0,
  small: 1,
  notable: 2.2,
  mastery: 2.6,
  gateway: 1.8,
  keystone: 0,
};

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

const formatTemplate = (template, focusTitle) => template.replace('{focusTitle}', focusTitle);

const toPixel = hex => ({
  x: RADIUS * (hex.q + hex.r / 2),
  y: RADIUS * (hex.r * Math.sqrt(3) / 2),
});

const neighbor = (hex, i) => {
  const d = HEX_DIRECTIONS[i % 6];
  return { q: hex.q + d.q, r: hex.r + d.r };
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
  if (ring === TREE_LAYERS && isHexCorner(hex, ring)) return 'gateway';
  if (ring >= 5 && index % 6 === 3) return 'keystone';
  if ((ring === 3 || ring === 5) && isPrimaryAxisNode(hex, ring)) return 'mastery';
  if (ring === 2 && index % 2 === 0) return 'notable';
  if (ring === 4 && index % 4 === 2) return 'notable';
  if (ring >= 5 && index % 5 === 2) return 'notable';
  return 'small';
};

const nodeCost = type => ({
  origin: 0,
  gateway: 2,
  keystone: 3,
  mastery: 2,
  notable: 2,
}[type] ?? 1);

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
  const scale = ring > 5 ? 7 : ring > 3 ? 6 : 5;
  const attrs = {
    STR: Math.round((weights.STR || 0) * scale),
    DEX: Math.round((weights.DEX || 0) * scale),
    INT: Math.round((weights.INT || 0) * scale),
  };
  const strongest = Object.entries(weights).sort((a, b) => b[1] - a[1])[0]?.[0] || 'STR';
  attrs[strongest] = Math.max(1, attrs[strongest]);
  return attrs;
};

const biasArcAttributes = (attrs, axis, side) => {
  const copy = { ...attrs };
  const primary = Object.entries(copy).sort((a, b) => b[1] - a[1])[0]?.[0] || 'STR';
  const secondaryByAxis = {
    INT: side < 0 ? 'DEX' : 'STR',
    DEX: side < 0 ? 'STR' : 'INT',
    STR: side < 0 ? 'INT' : 'DEX',
    HYBRID: side < 0 ? 'DEX' : 'STR',
  };
  const secondary = secondaryByAxis[axis] || secondaryByAxis[primary] || 'INT';
  if (copy[primary] > 1 && copy[secondary] === 0) {
    copy[primary] -= 1;
    copy[secondary] += 1;
  } else if (copy[primary] > 2 && copy[secondary] > 0) {
    copy[primary] -= 1;
    copy[secondary] += 1;
  }
  return copy;
};

const ringContent = ring => skillTreeContent.rings[Math.min(ring, skillTreeContent.rings.length - 1)]
  || skillTreeContent.rings[0];

const nodeStat = (axis, type, ring, index, focus = {}) => {
  if (type === 'origin' || type === 'keystone') {
    return { stat: null, amount: 0, statLabel: focus.special || 'Verdigris resonance' };
  }
  const pool = NODE_STAT_ROTATION[axis] || NODE_STAT_ROTATION.HYBRID;
  const [stat, statLabel] = pool[Math.abs(index) % pool.length];
  const multiplier = NODE_TYPE_MULTIPLIER[type] || 1;
  const base = ['life', 'mana', 'armour', 'evasion', 'energyShield'].includes(stat)
    ? 18 + ring * 9
    : 3 + ring * 1.4;
  return { stat, amount: round(base * multiplier), statLabel };
};

const createNodeData = (hex, type) => {
  const ring = hexDistance(hex);
  const pos = toPixel(hex);
  const weights = axisWeightsFromPosition(pos);
  const axis = ring === 0 ? 'HYBRID' : dominantAxis(weights);
  const content = ringContent(ring);
  const focus = content.focus?.[axis] || skillTreeContent.fallbackFocus?.default || {
    focusTitle: 'Verdigris',
    special: 'resonance',
  };
  const focusTitle = focus.focusTitle || 'Verdigris';
  const cost = nodeCost(type);
  const index = Math.abs(hex.q * 13 + hex.r * 17 + ring * 19);
  const statData = nodeStat(axis, type, ring, index, focus);

  if (type === 'origin') {
    const override = skillTreeContent.nodeOverrides?.n0;
    return {
      axis,
      weights,
      cost,
      name: override?.title || 'Prime Seed Nexus',
      effects: override?.effectSegments || ['Starting point.'],
      tags: ['HYB', 'origin'],
      stat: null,
      amount: 0,
    };
  }

  if (type === 'keystone') {
    const keystone = KEYSTONE_ENTRIES[index % Math.max(1, KEYSTONE_ENTRIES.length)] || {};
    return {
      axis,
      weights,
      cost,
      name: keystone.name || `${focusTitle} Keystone`,
      effects: [
        keystone.bonus || `+${Math.round((content.specialBase || 12) + ring * 3)}% ${focus.special}`,
        keystone.penalty || 'Requires a committed route.',
      ],
      tags: [VERDIGRIS_AXIS_META[axis].short, type, focus.special || 'keystone'],
      stat: null,
      amount: 0,
    };
  }

  const label = skillTreeContent.nodeTypeLabels?.[type === 'small' ? 'cluster' : type] || type;
  const titleTemplate = (content.naming || {})[type === 'small' ? 'cluster' : type] || `{focusTitle} ${label}`;
  const primary = axis === 'HYBRID' ? 'all Attributes' : VERDIGRIS_AXIS_META[axis].label;
  const primaryAmount = Math.round((content.primaryBase || 6) + ring * (content.primaryGrowth || 2));
  const effects = [
    `+${primaryAmount}% ${primary} scaling`,
    `+${formatNumber(statData.amount)}${statSuffix(statData.stat)} ${statData.statLabel}`,
  ];
  if (type === 'gateway') effects.push('Opens a remote Verdigris branch once connected.');
  if (type === 'mastery') effects.push(`Mastery: routes favor ${VERDIGRIS_AXIS_META[axis]?.short || 'HYB'} conduits.`);

  return {
    axis,
    weights,
    cost,
    name: formatTemplate(titleTemplate, focusTitle),
    effects,
    tags: [VERDIGRIS_AXIS_META[axis].short, type, focus.special || statData.statLabel],
    stat: statData.stat,
    amount: statData.amount,
  };
};

export const nodeRadius = (node, empowered = false) => {
  const base = {
    origin: 12,
    small: 6,
    notable: 10,
    mastery: 11,
    gateway: 12,
    keystone: 15,
  }[node.type] || 7;
  return empowered ? base + 3 : base;
};

class SkillNode {
  constructor(hex, type = 'small') {
    const data = createNodeData(hex, type);
    this.hex = hex;
    this.id = axialKey(hex.q, hex.r);
    this.pos = toPixel(hex);
    this.type = type;
    this.active = type === 'origin';
    this.connections = [];
    this.ring = hexDistance(hex);
    this.axis = data.axis;
    this.weights = data.weights;
    this.cost = data.cost;
    this.name = data.name;
    this.effects = data.effects;
    this.tags = data.tags;
    this.stat = data.stat;
    this.amount = data.amount;
  }
}

class Conduit {
  constructor(nodeA, nodeB) {
    this.id = edgeKey(nodeA.id, nodeB.id);
    this.fromId = nodeA.id;
    this.toId = nodeB.id;
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
    const attrs = biasArcAttributes(pathAttributesFromWeights(weights, Math.max(nodeA.ring, nodeB.ring)), axis, side);
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
  constructor() {
    this.nodes = new Map();
    this.conduits = new Map();
    this.points = {
      nodes: VERDIGRIS_SKILL_TREE_POINTS.nodes,
      conduits: VERDIGRIS_SKILL_TREE_POINTS.conduits,
    };
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
    this.recalculate();
  }

  generateTree(layers) {
    this.addNode({ q: 0, r: 0 }, 'origin');
    for (let layer = 1; layer <= layers; layer += 1) {
      let cursor = { q: 0, r: 0 };
      for (let k = 0; k < layer; k += 1) cursor = neighbor(cursor, 4);
      for (let side = 0; side < 6; side += 1) {
        for (let step = 0; step < layer; step += 1) {
          this.addNode(cursor, nodeTypeFor(cursor, layer));
          this.connectNeighbors(cursor);
          cursor = neighbor(cursor, side);
        }
      }
    }
  }

  addNode(hex, type) {
    const key = axialKey(hex.q, hex.r);
    if (!this.nodes.has(key)) this.nodes.set(key, new SkillNode(hex, type));
  }

  connectNeighbors(hex) {
    for (let i = 0; i < 6; i += 1) {
      const nHex = neighbor(hex, i);
      const key = axialKey(hex.q, hex.r);
      const nKey = axialKey(nHex.q, nHex.r);
      if (this.nodes.has(nKey)) this.addConduit(this.nodes.get(key), this.nodes.get(nKey));
    }
  }

  addConduit(nodeA, nodeB) {
    const id = edgeKey(nodeA.id, nodeB.id);
    if (this.conduits.has(id)) return this.conduits.get(id);
    const conduit = new Conduit(nodeA, nodeB);
    this.conduits.set(id, conduit);
    if (!nodeA.connections.includes(nodeB.id)) nodeA.connections.push(nodeB.id);
    if (!nodeB.connections.includes(nodeA.id)) nodeB.connections.push(nodeA.id);
    return conduit;
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
    this.points = {
      nodes: VERDIGRIS_SKILL_TREE_POINTS.nodes,
      conduits: VERDIGRIS_SKILL_TREE_POINTS.conduits,
    };
    this.pending = null;
    this.selectedNodeId = '0,0';
    this.log = ['Build reset to origin.'];
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
      .filter(item => item.neighbor && item.neighbor.active && item.conduit && !item.conduit.allocated)
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
    return weightedAttrs + axisBonus + inwardBonus;
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
    if (!node || node.active || this.points.nodes < node.cost || this.points.conduits < 1) return false;
    return this.getActiveNeighborConduitChoices(node).length > 0;
  }

  isAvailableConduit(conduit, optionId = null) {
    if (!conduit || conduit.allocated || this.points.conduits < 1) return false;
    if (optionId && !conduit.getOption(optionId)) return false;
    const fromNode = this.nodes.get(conduit.fromId);
    const toNode = this.nodes.get(conduit.toId);
    return Boolean(fromNode && toNode && fromNode.active && toNode.active);
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
    if (this.points.nodes < node.cost) {
      this.commit(`Not enough skill points for ${node.name}.`);
      this.recalculate();
      return;
    }
    if (this.points.conduits < 1) {
      this.commit(`No conduit points available for ${node.name}.`);
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
    this.points.nodes -= node.cost;
    this.points.conduits -= 1;
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
      this.saveHistory();
      conduit.allocatedVariant = option.id;
      this.points.conduits -= 1;
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
    this.points.nodes += node.cost;
    node.connections.forEach((neighborId) => {
      const conduit = this.conduits.get(edgeKey(node.id, neighborId));
      if (conduit && conduit.allocated) {
        conduit.allocatedVariant = null;
        this.points.conduits += 1;
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
    this.points.conduits += 1;
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
    lines.push(`${formatAttrs(boost.attrBonus)} from geometric resonance.`);
    return lines;
  }

  hexRingNodes(center, radius) {
    if (!center || radius < 1) return null;
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
    if (!ringNodes || ringNodes.some(node => !node.active)) return null;
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
      if (!node.active || node.ring === 0) return;
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
    const loopPower = loopDetails.reduce((sum, detail) => sum + detail.loops.reduce((total, loop) => total + loop.radius, 0), 0);
    const axisChains = this.computeAxisChains();
    const loopCount = this.computeExtraLoopCount();
    return [
      {
        id: 'circle',
        name: 'Loop Crowns',
        active: loopPower > 0,
        progress: `${loopDetails.length} center${loopDetails.length === 1 ? '' : 's'} crowned`,
        description: 'Closed hex loops empower their center.',
        attrs: { STR: loopPower * 3, DEX: loopPower * 3, INT: loopPower * 3 },
        derived: { spellDamage: loopPower * 9, energyShield: loopPower * 42, armour: loopPower * 42 },
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
