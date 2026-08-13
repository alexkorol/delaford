const RARITIES = new Set(['normal', 'magic', 'rare', 'unique', 'awakened']);

const humanise = value => String(value || '')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, letter => letter.toUpperCase())
  .trim();

const finiteNumber = value => (Number.isFinite(Number(value)) ? Number(value) : null);

export const getItemRarity = (item = {}) => {
  const explicit = String(item.rarity || '').toLowerCase();
  if (RARITIES.has(explicit)) {
    return explicit;
  }

  const vessel = item.vessel?.item;
  if (vessel?.awakened) {
    return 'awakened';
  }

  const brands = Array.isArray(vessel?.brands) ? vessel.brands.length : 0;
  const bonds = Array.isArray(vessel?.bonds) ? vessel.bonds.length : 0;
  const trophies = Array.isArray(vessel?.trophies) ? vessel.trophies.length : 0;
  if (trophies || (brands && bonds)) {
    return 'rare';
  }
  if (brands || bonds || item.affixes?.brand || item.affixes?.bond) {
    return 'magic';
  }

  return 'normal';
};

const legacyStatLines = (stats = {}) => Object.entries(stats).flatMap(([group, values]) => {
  if (!values || typeof values !== 'object') {
    return [];
  }

  return Object.entries(values).flatMap(([name, rawValue]) => {
    const value = finiteNumber(rawValue);
    if (value === null || value === 0) {
      return [];
    }
    const sign = value > 0 ? '+' : '';
    return [`${sign}${value} ${humanise(name)} ${humanise(group)}`];
  });
});

const tooltipLines = item => (Array.isArray(item?.vessel?.lines) ? item.vessel.lines : [])
  .filter(line => line && line.section !== 'name' && typeof line.text === 'string' && line.text.trim())
  .slice(0, 40)
  .map(line => ({
    section: String(line.section || 'detail').toLowerCase(),
    text: line.text.trim(),
    tone: String(line.tone || 'normal').toLowerCase(),
  }));

const bindingLabel = (item) => {
  const relic = item?.chroniclesRelic;
  if (relic?.houseName && relic?.scionName) {
    return `House ${relic.houseName} heirloom · carried by ${relic.scionName}`;
  }
  if (relic?.houseName) {
    return `House ${relic.houseName} heirloom`;
  }
  if (item?.boundTo) {
    return 'Bound item';
  }
  return '';
};

export const buildItemTooltipModel = (item = {}, dimensions = { width: 1, height: 1 }) => {
  const rarity = getItemRarity(item);
  const equipSlot = item.equipSlot || item.slotType || item.wearSlot || item.equipmentSlot;
  const meta = [
    humanise(item.type || 'item'),
    equipSlot ? humanise(equipSlot) : '',
    `${Math.max(1, Number(dimensions.width) || 1)} × ${Math.max(1, Number(dimensions.height) || 1)}`,
  ].filter(Boolean);
  const quantity = finiteNumber(item.qty);

  return {
    name: item.displayName || item.name || item.id || 'Unknown Item',
    rarity,
    rarityLabel: humanise(rarity),
    meta,
    quantity: quantity && quantity > 1 ? Math.floor(quantity) : null,
    vesselLines: tooltipLines(item),
    statLines: legacyStatLines(item.stats).slice(0, 12),
    binding: bindingLabel(item),
    description: typeof item.examine === 'string' ? item.examine.trim() : '',
  };
};

export const itemTooltipAriaLabel = (item, dimensions) => {
  const model = buildItemTooltipModel(item, dimensions);
  return `${model.name} (${dimensions.width} x ${dimensions.height})`;
};

export default buildItemTooltipModel;
