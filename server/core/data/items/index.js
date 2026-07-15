import weapons from './weapons.js';
import armor from './armor.js';
import belts from './belts.js';
import jewelry from './jewelry.js';
import general from './general.js';
import verdigris from './verdigris.js';

import smithing from './skills/smithing.js';

const wearableItems = [...weapons, ...armor, ...belts, ...jewelry, ...verdigris];

export {
  armor, belts, weapons, jewelry, general, smithing, verdigris, wearableItems,
};
