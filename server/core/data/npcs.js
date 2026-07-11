export default [
  {
    id: 1,
    name: 'Baynard',
    examine: 'Local town bum. Phew!',
    graphic: {
      row: 0,
      column: 0,
    },
    actions: [
      'examine',
    ],
    spawn: {
      x: 34,
      y: 116,
      range: 3,
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
    name: 'Bank gnome',
    examine: 'Helps with your finances and assets, I believe.',
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
      range: 2,
    },
  },
];
