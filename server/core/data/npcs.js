export default [
  {
    id: 1,
    name: 'Aldwyn the Guide',
    examine: 'A weathered wayfinder who watches over the Crossroads\' newest scions.',
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
    examine: 'Keeps the general stall at the Crossroads bazaar. Buys most things, sells the rest.',
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
    examine: 'Sells iron for the road. Claims every axe on his boards outlived its first three owners.',
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
    name: 'Rhea of the Countinghouse',
    examine: 'Keeps the countinghouse tent: personal storage, honest scales, no questions.',
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
