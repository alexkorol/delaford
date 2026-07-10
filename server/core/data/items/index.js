import weapons from './weapons.js';
import armor from './armor.js';
import jewelry from './jewelry.js';
import general from './general.js';
import verdigris from './verdigris.js';

import smithing from './skills/smithing.js';

const wearableItems = [...weapons, ...armor, ...jewelry, ...verdigris];

export {
  armor, weapons, jewelry, general, smithing, verdigris, wearableItems,
};
