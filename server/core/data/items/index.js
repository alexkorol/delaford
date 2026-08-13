import weapons from './weapons.js';
import armor from './armor.js';
import jewelry from './jewelry.js';
import general from './general.js';
import vessels from './vessels.js';

import smithing from './skills/smithing.js';

const wearableItems = [...weapons, ...armor, ...jewelry, ...vessels];

export {
  armor, weapons, jewelry, vessels, general, smithing, wearableItems,
};
