const RARITIES = new Set(['normal', 'magic', 'rare', 'unique']);

export const getInventoryItemRarity = (item = {}) => {
  const safeItem = item || {};
  const explicit = String(safeItem.rarity || '').toLowerCase();
  if (RARITIES.has(explicit)) {
    return explicit;
  }

  if (safeItem.vessel?.item?.awakened) {
    return 'unique';
  }

  const vesselItem = safeItem.vessel?.item;
  const vesselPowers = (vesselItem?.brands?.length || 0)
    + (vesselItem?.bonds?.length || 0)
    + (vesselItem?.trophies?.length || 0);
  const legacyPowers = Number(Boolean(safeItem.affixes?.brand)) + Number(Boolean(safeItem.affixes?.bond));

  if (vesselPowers >= 3 || legacyPowers >= 2) {
    return 'rare';
  }

  if (vesselPowers || legacyPowers) {
    return 'magic';
  }

  return 'normal';
};

export const getInventoryItemName = (item = {}) => (
  item?.displayName || item?.name || item?.baseName || item?.id || 'Item'
);

const formatStatGroup = (label, stats = {}) => {
  const entries = Object.entries(stats)
    .filter(([, value]) => Number.isFinite(value) && value !== 0)
    .map(([key, value]) => {
      const statName = key.charAt(0).toUpperCase() + key.slice(1);
      const sign = value > 0 ? '+' : '';
      return `${statName} ${sign}${value}`;
    });

  return entries.length ? `${label} · ${entries.join(' · ')}` : null;
};

export const getInventoryCombatLines = (item = {}) => [
  formatStatGroup('Attack', item?.stats?.attack),
  formatStatGroup('Defense', item?.stats?.defense),
].filter(Boolean);

export const getInventoryVesselPips = (item = {}) => {
  const vessel = item?.vessel?.item;
  if (!vessel || !Number.isFinite(vessel.vessel) || vessel.vessel <= 0) {
    return [];
  }

  const pips = [];
  (vessel.brands || []).forEach(() => pips.push({ kind: 'brand', symbol: '✦' }));
  (vessel.bonds || []).forEach(() => pips.push({ kind: 'bond', symbol: '◆' }));
  (vessel.trophies || []).forEach(() => pips.push({ kind: 'trophy', symbol: '◇' }));
  for (let index = 0; index < (vessel.scars || 0); index += 1) {
    pips.push({ kind: 'scar', symbol: '×' });
  }

  const emptySlots = Math.max(0, vessel.vessel - pips.length);
  for (let index = 0; index < emptySlots; index += 1) {
    pips.push({ kind: 'empty', symbol: '○' });
  }

  return pips;
};

export const getInventoryTooltipLines = (item = {}) => {
  const safeItem = item || {};
  const vesselLines = Array.isArray(safeItem.vessel?.lines)
    ? safeItem.vessel.lines
      .filter(line => line && !['name', 'stat', 'attune'].includes(line.section))
      .map(line => ({
        section: line.section || 'stat',
        text: String(line.text || ''),
        tone: line.tone || 'normal',
      }))
      .filter(line => line.text)
    : [];

  const legacyLines = ['brand', 'bond']
    .map((kind) => {
      const affix = safeItem.affixes?.[kind];
      if (!affix) {
        return null;
      }
      return {
        section: kind,
        text: `${kind === 'brand' ? '✦' : '◆'} ${affix.name}${affix.tier ? ` · Tier ${affix.tier}` : ''}`,
        tone: kind,
      };
    })
    .filter(Boolean);

  return [...legacyLines, ...vesselLines];
};

export const getInventoryAttunement = (item = {}) => {
  const attunement = item?.vessel?.item?.att;
  if (!attunement || !Number.isFinite(attunement.next) || attunement.next <= 0) {
    return null;
  }

  const current = Number.isFinite(attunement.xp) ? Math.max(0, attunement.xp) : 0;
  return {
    current,
    next: attunement.next,
    percent: Math.min(100, Math.round((current / attunement.next) * 100)),
  };
};
