export const ACTOR_FRAME_SIZE = 64;

export const SURFACE_MONSTER_COLUMNS = Object.freeze({
  'ashen-wolf': 0,
  'hollow-guard': 1,
  'ember-seer': 2,
  'oldwood-wolf': 3,
  'thorn-stalker': 4,
  'mossbound-brute': 5,
  'reed-witch': 6,
  'bog-revenant': 7,
  'hollow-warden': 8,
  'barrow-sister': 9,
  'crypt-guard': 10,
  'bone-oracle': 11,
  'barrow-knight': 12,
  'ember-guard': 13,
  'ash-seer': 14,
});

export const INSTANCE_MONSTER_COLUMNS = Object.freeze({
  stone: Object.freeze({ melee: 15, ranged: 16, support: 17, boss: 18 }),
  crypt: Object.freeze({ melee: 19, ranged: 20, support: 21, boss: 22 }),
  sand: Object.freeze({ melee: 23, ranged: 24, support: 25, boss: 26 }),
  volcanic: Object.freeze({ melee: 27, ranged: 28, support: 29, boss: 30 }),
  marsh: Object.freeze({ melee: 31, ranged: 32, support: 33, boss: 34 }),
  grove: Object.freeze({ melee: 35, ranged: 36, support: 37, boss: 38 }),
  wilds: Object.freeze({ melee: 39, ranged: 40, support: 41, boss: 42 }),
});

const graphicAt = column => ({ column, row: 0 });

export const surfaceMonsterGraphic = (id) => {
  const column = SURFACE_MONSTER_COLUMNS[id];
  return graphicAt(Number.isFinite(column) ? column : 0);
};

export const instanceMonsterGraphic = (theme, role) => {
  const themeColumns = INSTANCE_MONSTER_COLUMNS[theme] || INSTANCE_MONSTER_COLUMNS.stone;
  const column = themeColumns[role];
  return graphicAt(Number.isFinite(column) ? column : themeColumns.melee);
};
