import weapons from './weapons.js';
import armor from './armor.js';
import belts from './belts.js';
import jewelry from './jewelry.js';
import general from './general.js';
import vessels from './vessels.js';
import verdigris from './verdigris.js';

import smithing from './skills/smithing.js';

const wearableItems = [...weapons, ...armor, ...belts, ...jewelry, ...vessels, ...verdigris];

export {
  armor, belts, weapons, jewelry, vessels, verdigris, general, smithing, wearableItems,

};
