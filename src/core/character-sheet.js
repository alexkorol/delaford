import { ATTRIBUTE_IDS, ATTRIBUTE_LABELS } from '@shared/stats/index.js';

export const EQUIPMENT_SLOTS = [
  { id: 'right_hand', label: 'Weapon', empty: 'Unarmed' },
  { id: 'left_hand', label: 'Offhand', empty: 'Bare hand' },
  { id: 'armor', label: 'Body', empty: 'Unarmoured' },
  { id: 'head', label: 'Head', empty: 'Bare head' },
  { id: 'back', label: 'Cloak', empty: 'No cloak' },
  { id: 'belt', label: 'Belt', empty: 'No belt' },
  { id: 'gloves', label: 'Gloves', empty: 'Bare hands' },
  { id: 'feet', label: 'Feet', empty: 'Bare feet' },
  { id: 'ring', label: 'Ring', empty: 'No ring' },
  { id: 'ring2', label: 'Ring', empty: 'No ring' },
  { id: 'necklace', label: 'Amulet', empty: 'No amulet' },
];

export const RESISTANCE_ROWS = [
  { id: 'fire', label: 'Fire' },
  { id: 'cold', label: 'Cold' },
  { id: 'poison', label: 'Poison' },
  { id: 'electric', label: 'Lightning' },
  { id: 'negative', label: 'Necrotic' },
  { id: 'willpower', label: 'Willpower' },
];

export const DCSS_TILE_SIZE = 32;

const dcssTile = (atlas, column, row, label) => ({
  atlas,
  column,
  row,
  label,
  tileSize: DCSS_TILE_SIZE,
});

export const DCSS_CHARACTER_TILE = dcssTile('dungeon', 12, 8, 'DCSS adventurer placeholder');

export const DCSS_EQUIPMENT_SLOT_TILES = {
  right_hand: dcssTile('objects', 1, 27, 'Weapon'),
  left_hand: dcssTile('objects', 3, 27, 'Shield'),
  armor: dcssTile('objects', 4, 25, 'Body armour'),
  head: dcssTile('objects', 0, 28, 'Headgear'),
  back: dcssTile('objects', 0, 25, 'Cloak'),
  belt: dcssTile('objects', 4, 25, 'Belt'),
  gloves: dcssTile('objects', 6, 27, 'Gloves'),
  feet: dcssTile('objects', 8, 27, 'Footwear'),
  ring: dcssTile('objects', 8, 26, 'Ring'),
  ring2: dcssTile('objects', 8, 26, 'Ring'),
  necklace: dcssTile('objects', 1, 28, 'Amulet'),
};

const COMBAT_TYPES = ['stab', 'slash', 'crush', 'range'];
const SKILL_ORDER = [
  'attack',
  'defence',
  'mining',
  'smithing',
  'woodcutting',
  'crafting',
  'magic',
  'ranged',
];

const RESISTANCE_ALIASES = {
  fire: ['fire', 'rF', 'rf', 'rFire'],
  cold: ['cold', 'rC', 'rc', 'rCold'],
  poison: ['poison', 'rPois', 'rPoison'],
  electric: ['electric', 'electricity', 'rElec', 'shock'],
  negative: ['negative', 'rN', 'negativeEnergy'],
  willpower: ['willpower', 'will', 'Will', 'magicResistance'],
};

const ITEM_TILE_RULES = [
  { matches: ['shield', 'buckler'], tile: DCSS_EQUIPMENT_SLOT_TILES.left_hand },
  { matches: ['sword', 'dagger', 'blade', 'axe', 'mace', 'hammer', 'halberd', 'spear'], tile: DCSS_EQUIPMENT_SLOT_TILES.right_hand },
  { matches: ['bow', 'wand', 'staff'], tile: dcssTile('objects', 7, 27, 'Wand') },
  { matches: ['helmet', 'helm', 'hat', 'cap'], tile: DCSS_EQUIPMENT_SLOT_TILES.head },
  { matches: ['cloak', 'cape', 'mantle'], tile: DCSS_EQUIPMENT_SLOT_TILES.back },
  { matches: ['glove', 'gauntlet'], tile: DCSS_EQUIPMENT_SLOT_TILES.gloves },
  { matches: ['boot', 'shoe', 'greave'], tile: DCSS_EQUIPMENT_SLOT_TILES.feet },
  { matches: ['ring'], tile: DCSS_EQUIPMENT_SLOT_TILES.ring },
  { matches: ['amulet', 'necklace'], tile: DCSS_EQUIPMENT_SLOT_TILES.necklace },
  { matches: ['armor', 'armour', 'mail', 'robe', 'plate', 'body'], tile: DCSS_EQUIPMENT_SLOT_TILES.armor },
];

const toNumber = value => (Number.isFinite(Number(value)) ? Number(value) : 0);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const titleCase = value => String(value || '')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, char => char.toUpperCase());

const meterFromSources = (sources, fallback = {}) => {
  const source = sources.find(candidate => candidate && typeof candidate === 'object') || fallback;
  const current = toNumber(source.current ?? source.value ?? source.amount ?? 0);
  const max = toNumber(source.max ?? source.maximum ?? source.capacity ?? fallback.max ?? 0);
  return { current, max };
};

const sumCombatMap = (map = {}) => COMBAT_TYPES.reduce((total, key) => total + toNumber(map[key]), 0);

const hasCombatValues = map => Boolean(map && COMBAT_TYPES.some(key => Number.isFinite(Number(map[key]))));

const sumWearCombat = (wear = {}, type) => Object.values(wear || {}).reduce((total, item) => {
  if (!item || !item.stats || !item.stats[type]) {
    return total;
  }
  return total + sumCombatMap(item.stats[type]);
}, 0);

const combatTotal = (player = {}, type) => {
  const combatMap = player.combat && player.combat[type];
  if (hasCombatValues(combatMap)) {
    return sumCombatMap(combatMap);
  }
  return sumWearCombat(player.wear, type);
};

const slotDefenseTotal = item => (item && item.stats && item.stats.defense ? sumCombatMap(item.stats.defense) : 0);

const cloneTile = tile => ({ ...tile });

const normaliseExplicitTile = (tile) => {
  if (!tile || typeof tile !== 'object') {
    return null;
  }

  const column = Number(tile.column);
  const row = Number(tile.row);
  if (!Number.isInteger(column) || !Number.isInteger(row) || column < 0 || row < 0) {
    return null;
  }

  return {
    atlas: tile.atlas || 'objects',
    column,
    row,
    label: tile.label || 'Item',
    tileSize: Number.isFinite(Number(tile.tileSize)) ? Number(tile.tileSize) : DCSS_TILE_SIZE,
  };
};

const itemSearchText = item => [
  item.id,
  item.name,
  item.displayName,
  item.type,
  item.slot,
].filter(Boolean).join(' ').toLowerCase();

export const resolveDcssEquipmentTile = (slotId, item = null) => {
  const explicitTile = normaliseExplicitTile(item && (item.dcssTile || item.tile));
  if (explicitTile) {
    return explicitTile;
  }

  if (item) {
    const searchText = itemSearchText(item);
    const rule = ITEM_TILE_RULES.find(candidate => candidate.matches.some(match => searchText.includes(match)));
    if (rule) {
      return cloneTile(rule.tile);
    }
  }

  return cloneTile(DCSS_EQUIPMENT_SLOT_TILES[slotId] || DCSS_EQUIPMENT_SLOT_TILES.right_hand);
};

const readResistance = (item, id) => {
  if (!item) {
    return 0;
  }

  const aliases = RESISTANCE_ALIASES[id] || [id];
  const containers = [
    item.resistances,
    item.resistance,
    item.stats && item.stats.resistances,
    item.stats && item.stats.resistance,
  ].filter(Boolean);

  return containers.reduce((total, container) => {
    const key = aliases.find(alias => Number.isFinite(Number(container[alias])));
    return total + (key ? toNumber(container[key]) : 0);
  }, 0);
};

export const formatResistancePips = (value) => {
  const amount = clamp(Math.round(toNumber(value)), -3, 3);
  if (amount === 0) {
    return '.';
  }
  return amount > 0 ? '+'.repeat(amount) : '-'.repeat(Math.abs(amount));
};

export const buildCharacterSheet = (player = {}) => {
  const stats = player.stats || {};
  const attributesTotal = (stats.attributes && stats.attributes.total) || player.attributes || {};
  const resources = stats.resources || {};
  const wear = player.wear || {};
  const level = Math.max(1, toNumber(stats.level || player.level || 1));
  const attackTotal = combatTotal(player, 'attack');
  const defenseTotal = combatTotal(player, 'defense');
  const strength = toNumber(attributesTotal.strength || 10);
  const dexterity = toNumber(attributesTotal.dexterity || 10);
  const intelligence = toNumber(attributesTotal.intelligence || 10);
  const shieldDefense = slotDefenseTotal(wear.left_hand);
  const armourDefense = slotDefenseTotal(wear.armor);

  const hp = meterFromSources([resources.health, player.hp, player.health]);
  const mp = meterFromSources([resources.mana, player.mana, player.mp]);
  const lifecycle = player.lifecycle || stats.lifecycle || {};

  const defenses = [
    { id: 'ac', label: 'AC', value: Math.max(0, Math.round((defenseTotal / 4) + (strength / 4))) },
    { id: 'ev', label: 'EV', value: Math.max(0, Math.round(8 + (dexterity / 3) - (armourDefense / 18))) },
    { id: 'sh', label: 'SH', value: Math.max(0, Math.round(shieldDefense / 3)) },
    { id: 'will', label: 'Will', value: Math.max(0, Math.round((intelligence / 3) + (level / 2))) },
  ];

  const offense = [
    { id: 'accuracy', label: 'Acc', value: Math.max(0, Math.round(attackTotal + (dexterity / 2))) },
    { id: 'damage', label: 'Dmg', value: Math.max(1, Math.round((attackTotal / 2) + (strength / 2))) },
    { id: 'range', label: 'Rng', value: Math.max(1, Math.round(toNumber(player.combat?.attack?.range) || 1)) },
    { id: 'speed', label: 'Spd', value: Math.max(1, Math.round(toNumber(player.movementSpeed || player.speed || 10) || 10)) },
  ];

  const resistances = RESISTANCE_ROWS.map(row => {
    const value = Object.values(wear).reduce((total, item) => total + readResistance(item, row.id), 0);
    return {
      ...row,
      value,
      pips: formatResistancePips(value),
    };
  });

  const equipment = EQUIPMENT_SLOTS.map(slot => {
    const item = wear[slot.id] || null;
    return {
      ...slot,
      item,
      name: item ? (item.displayName || item.name || item.id || 'Unknown') : slot.empty,
      rarity: item && item.rarity ? String(item.rarity).toLowerCase() : 'normal',
      tile: resolveDcssEquipmentTile(slot.id, item),
    };
  });

  const skills = Object.entries(player.skills || {}).map(([id, skill]) => ({
    id,
    label: titleCase(id),
    level: Math.max(1, toNumber(skill && skill.level) || 1),
    exp: Math.max(0, toNumber(skill && skill.exp)),
  })).sort((a, b) => {
    const aOrder = SKILL_ORDER.includes(a.id) ? SKILL_ORDER.indexOf(a.id) : SKILL_ORDER.length;
    const bOrder = SKILL_ORDER.includes(b.id) ? SKILL_ORDER.indexOf(b.id) : SKILL_ORDER.length;
    return aOrder === bOrder ? a.label.localeCompare(b.label) : aOrder - bOrder;
  });

  const attributes = ATTRIBUTE_IDS.map(id => ({
    id,
    label: ATTRIBUTE_LABELS[id] || titleCase(id),
    value: toNumber(attributesTotal[id] || 0),
  }));

  return {
    identity: {
      name: player.username || player.name || 'Adventurer',
      level,
      state: lifecycle.state || 'alive',
      tile: cloneTile(DCSS_CHARACTER_TILE),
    },
    resources: { hp, mp },
    attributes,
    defenses,
    offense,
    resistances,
    equipment,
    skills,
  };
};

export default buildCharacterSheet;
