import { presetActions } from '#server/core/data/helpers/database.js';

// Waist slot gear. Art comes from the ported WIZARD inventory pack via `artId`
// (src/assets/inventory/items/girdle_*.png, girded_sash.png); `graphics` is a
// harmless spritesheet fallback for the ground/canvas render. Stats favour
// defense, in line with the early gloves/boots tiers.
export default [
  {
    id: 'hide-girdle',
    name: 'Hide Girdle',
    examine: 'A simple girdle of stitched hide.',
    price: 8,
    type: 'armor',
    slot: 'belt',
    artId: 'girdle-hide',
    stats: {
      attack: {
        stab: 0, slash: 0, crush: 0, range: 0,
      },
      defense: {
        stab: 1, slash: 1, crush: 1, range: 0,
      },
    },
    graphics: {
      tileset: 'armor',
      row: 0,
      column: 0,
    },
    actions: presetActions(['wearable']),
  },
  {
    id: 'quilted-girdle',
    name: 'Quilted Girdle',
    examine: 'Padded cloth wrapped and belted at the waist.',
    price: 12,
    type: 'armor',
    slot: 'belt',
    artId: 'girdle-quilted',
    stats: {
      attack: {
        stab: 0, slash: 0, crush: 0, range: 0,
      },
      defense: {
        stab: 1, slash: 2, crush: 1, range: 1,
      },
    },
    graphics: {
      tileset: 'armor',
      row: 0,
      column: 0,
    },
    actions: presetActions(['wearable']),
  },
  {
    id: 'girded-sash',
    name: 'Girded Sash',
    examine: 'A light sash favoured by those who trust speed over plate.',
    price: 40,
    type: 'armor',
    slot: 'belt',
    artId: 'girded-sash',
    stats: {
      attack: {
        stab: 1, slash: 1, crush: 0, range: 1,
      },
      defense: {
        stab: 1, slash: 1, crush: 0, range: 2,
      },
    },
    graphics: {
      tileset: 'armor',
      row: 0,
      column: 0,
    },
    actions: presetActions(['wearable']),
  },
  {
    id: 'copper-girdle',
    name: 'Copper Girdle',
    examine: 'Beaten copper plates riveted onto a leather band.',
    price: 60,
    type: 'armor',
    slot: 'belt',
    artId: 'girdle-copper',
    stats: {
      attack: {
        stab: 0, slash: 0, crush: 0, range: 0,
      },
      defense: {
        stab: 2, slash: 2, crush: 2, range: 1,
      },
    },
    graphics: {
      tileset: 'armor',
      row: 0,
      column: 0,
    },
    actions: presetActions(['wearable']),
  },
  {
    id: 'bronzeplate-girdle',
    name: 'Bronzeplate Girdle',
    examine: 'A heavy girdle of overlapping bronze plates.',
    price: 120,
    type: 'armor',
    slot: 'belt',
    artId: 'girdle-bronzeplate',
    stats: {
      attack: {
        stab: 0, slash: 0, crush: 0, range: 0,
      },
      defense: {
        stab: 3, slash: 3, crush: 3, range: 2,
      },
    },
    graphics: {
      tileset: 'armor',
      row: 0,
      column: 0,
    },
    actions: presetActions(['wearable']),
  },
  {
    id: 'skymetal-girdle',
    name: 'Skymetal Girdle',
    examine: 'Cold, star-fallen metal worked into a broad war-belt.',
    price: 320,
    type: 'armor',
    slot: 'belt',
    artId: 'girdle-skymetal',
    stats: {
      attack: {
        stab: 0, slash: 0, crush: 0, range: 0,
      },
      defense: {
        stab: 4, slash: 4, crush: 4, range: 3,
      },
    },
    graphics: {
      tileset: 'armor',
      row: 0,
      column: 0,
    },
    actions: presetActions(['wearable']),
  },
];
