// Temporary bridge from the legacy Verdigris catalogue to the accepted WIZARD
// inventory art. Keep every override here so the planned systematic art pass
// can replace this module without touching inventory or equipment components.
const artModules = import.meta.glob('../../assets/inventory/items/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const ART_URLS = Object.freeze(Object.fromEntries(
  Object.entries(artModules).map(([path, url]) => {
    const filename = path.split('/').pop() || '';
    return [filename.replace(/\.png$/i, ''), url];
  }),
));

export const LEGACY_ITEM_ART = Object.freeze({
  // Weapons
  'bronze-sword': 'steel_longsword',
  'bronze-axe': 'handaxe_bronze',
  'bronze-pickaxe': 'handaxe_bronze',
  'bronze-dagger': 'dagger_bronze',
  'bronze-mace': 'warclub_bronze',
  'bronze-battleaxe': 'greataxe_bronze',
  'bronze-halberd': 'boar_pike',
  'bronze-warhammer': 'sceptre_bronze',
  'bronze-spear': 'boar_pike',
  'iron-sword': 'steel_longsword',
  'iron-axe': 'war_axe',
  'iron-pickaxe': 'war_axe',
  'iron-dagger': 'stiletto',
  'iron-mace': 'warclub_skymetal',
  'iron-battleaxe': 'greataxe_skymetal',
  'iron-halberd': 'spear_skymetal',
  'iron-warhammer': 'warclub_skymetal',
  'iron-spear': 'spear_skymetal',
  'steel-sword': 'steel_longsword',
  'steel-axe': 'handaxe_skymetal',
  'steel-pickaxe': 'war_axe',
  'steel-dagger': 'dagger_skymetal',
  'steel-mace': 'warclub_skymetal',
  'steel-battleaxe': 'greataxe_skymetal',
  'steel-halberd': 'spear_skymetal',
  'steel-warhammer': 'warclub_skymetal',
  'steel-spear': 'spear_skymetal',
  'jatite-sword': 'khopesh_skymetal',
  'jatite-axe': 'handaxe_obsidian',
  'jatite-pickaxe': 'war_axe',
  'jatite-dagger': 'dagger_obsidian',
  'jatite-mace': 'warclub_jade',
  'jatite-battleaxe': 'greataxe_obsidian',
  'jatite-halberd': 'spear_obsidian',
  'jatite-warhammer': 'warclub_jade',
  'jatite-spear': 'spear_obsidian',

  // Armour and off-hands
  'bronze-med-helm': 'crest_bronze',
  'bronze-boots': 'greaves_bronze',
  'bronze-gloves': 'bracers_bronzeplate',
  'bronze-chainmail': 'wrap_bronzescale',
  'bronze-pavise': 'tower_shield',
  'bronze-shield': 'buckler_bronze',
  'bronze-armor': 'astral_plate',
  'bronze-helm': 'helm_bronzescale',
  'iron-med-helm': 'helm_bronzescale',
  'iron-boots': 'greaves_bronzescale',
  'iron-gloves': 'chain_gauntlets',
  'iron-chainmail': 'astral_plate',
  'iron-pavise': 'tower_shield',
  'iron-shield': 'tower_shield',
  'iron-armor': 'astral_plate',
  'iron-helm': 'helm_bronzescale',
  'leather-cowl': 'crest_hide',
  'leather-boots': 'boots_fur',
  'leather-body': 'wrap_hide',
  'hard-leather-cowl': 'crest_hide',
  'hard-leather-boots': 'wayfarer_boots',
  'hard-leather-body': 'wrap_studded',
  'ranger-boots': 'wayfarer_boots',
  'wooden-shield': 'hideshield_rawhide_oval',
  'training-shield': 'buckler_hide',
  'robe-of-fire': 'ember_shell',

  // Jewellery and general-purpose items
  'garnet-amulet': 'lunula_bronze',
  'tanzanite-amulet': 'gorget_jade',
  'hematite-amulet': 'onyx_amulet',
  'peridot-amulet': 'gorget_jade',
  ring: 'iron_ring',
  'gold-ring': 'signet_bronze',
  'tanzanite-ring': 'coral_ring',
  hammer: 'warclub_bronze',
  knife: 'cur_knife',
  lantern: 'relic_curio',
});

const normaliseArtId = value => String(value || '')
  .trim()
  .replace(/\.png$/i, '')
  .replace(/-/g, '_');

export const hasInventoryItemArt = artId => Boolean(ART_URLS[normaliseArtId(artId)]);

export const resolveInventoryItemArtId = (item = {}) => {
  const explicit = normaliseArtId(item.artId || item.inventoryArtId || item.graphics?.artId);
  if (explicit && ART_URLS[explicit]) {
    return explicit;
  }

  const catalogueId = String(item.baseId || item.id || '').toLowerCase();
  const legacy = LEGACY_ITEM_ART[catalogueId];
  if (legacy && ART_URLS[legacy]) {
    return legacy;
  }

  const direct = normaliseArtId(item.baseId || item.id);
  if (direct && ART_URLS[direct]) {
    return direct;
  }

  return null;
};

export const resolveInventoryItemArt = (item = {}) => {
  const artId = resolveInventoryItemArtId(item);
  return artId ? ART_URLS[artId] : null;
};

export const acceptedInventoryArtIds = Object.freeze(Object.keys(ART_URLS).sort());

export default resolveInventoryItemArt;
