// Chronicles class archetypes — plain names on purpose (Warrior/Rogue/Mage,
// no invented titles). Each leans on one attribute axis and maps onto a
// Vesselforge kinship so gear bonds recognise their bearer.
//
// Attribute spreads keep the default 30-point total (10/10/10) but tilt it:
// primary 13, secondary 10, tertiary 7.

const CHARACTER_ARCHETYPES = [
  {
    id: 'warrior',
    name: 'Warrior',
    description: 'The wall the House hides behind. Slow to learn, slower to die.',
    primary: 'strength',
    attributes: { strength: 13, dexterity: 10, intelligence: 7 },
    kinship: 'shieldbearer',
  },
  {
    id: 'rogue',
    name: 'Rogue',
    description: 'Quick hands, quicker feet. Finds what others walk past.',
    primary: 'dexterity',
    attributes: { strength: 10, dexterity: 13, intelligence: 7 },
    kinship: 'farwalker',
  },
  {
    id: 'mage',
    name: 'Mage',
    description: 'Reads entrails and skies. Knows much, bleeds easily.',
    primary: 'intelligence',
    attributes: { strength: 7, dexterity: 10, intelligence: 13 },
    kinship: 'ashspeaker',
  },
];

const DEFAULT_ARCHETYPE_ID = 'warrior';

const getArchetype = id => CHARACTER_ARCHETYPES.find(archetype => archetype.id === id) || null;

const resolveArchetype = id => getArchetype(id) || getArchetype(DEFAULT_ARCHETYPE_ID);

const isValidArchetypeId = id => Boolean(getArchetype(id));

export {
  CHARACTER_ARCHETYPES,
  DEFAULT_ARCHETYPE_ID,
  getArchetype,
  resolveArchetype,
  isValidArchetypeId,
};

export default {
  CHARACTER_ARCHETYPES,
  DEFAULT_ARCHETYPE_ID,
  getArchetype,
  resolveArchetype,
  isValidArchetypeId,
};
