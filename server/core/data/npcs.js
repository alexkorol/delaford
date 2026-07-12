export default [
  {
    id: 1,
    name: 'Aldwyn the Guide',
    examine: 'A weathered guide who watches over Delaford\'s newest scions.',
    graphic: {
      row: 0,
      column: 0,
    },
    actions: [
      'talk',
      'examine',
    ],
    spawn: {
      x: 34,
      y: 116,
      range: 0,
    },
  },
  {
    id: 2,
    name: 'Mara, General Trader',
    examine: 'Sells and buys items in exchange for coins.',
    graphic: {
      row: 0,
      column: 1,
    },
    actions: [
      'trade',
      'examine',
    ],
    spawn: {
      x: 49,
      y: 103,
      range: 1,
    },
  },
  {
    id: 3,
    name: 'Ludovicus, Weapons Trader',
    examine: 'Woodhurst\'s cheerful town shopkeeper.',
    graphic: {
      row: 0,
      column: 2,
    },
    actions: [
      'examine',
      'trade',
    ],
    spawn: {
      x: 19,
      y: 113,
      range: 2,
    },
  },
  {
    id: 4,
    name: 'Rhea, House Banker',
    examine: 'Stores items and transfers a scion\'s carried gold into the House treasury.',
    graphic: {
      row: 0,
      column: 3,
    },
    actions: [
      'examine',
      'bank',
    ],
    spawn: {
      x: 31,
      y: 121,
      range: 0,
    },
  },
];
