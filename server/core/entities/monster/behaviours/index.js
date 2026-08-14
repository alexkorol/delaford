import registerMeleeBehaviour from './melee.js';
import registerRangedBehaviour from './ranged.js';
import registerSupportBehaviour from './support.js';
import registerBufferBehaviour from './buffer.js';

const behaviourRegistry = {
  melee: registerMeleeBehaviour,
  ranged: registerRangedBehaviour,
  support: registerSupportBehaviour,
  buffer: registerBufferBehaviour,
};

export const resolveBehaviour = (type = 'melee') => (
  behaviourRegistry[type] || behaviourRegistry.melee
);

export default behaviourRegistry;
