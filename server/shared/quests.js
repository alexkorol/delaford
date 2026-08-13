export const QUEST_SCHEMA_VERSION = 1;
export const MAX_QUEST_POINTS = 23;

export const QUEST_DEFINITIONS = [
  {
    id: 'aldwyns-charge',
    title: "Aldwyn's Charge",
    description: 'Learn the rhythm of Delaford, then cross the threshold into an Adventure realm.',
    objectives: [
      { id: 'move', trigger: 'move', label: 'Walk through Delaford' },
      { id: 'attack', trigger: 'attack', label: 'Strike a hostile creature' },
      { id: 'slay', trigger: 'slay', label: 'Slay a hostile creature' },
      { id: 'loot', trigger: 'loot', label: 'Claim an item from the ground' },
      { id: 'delve', trigger: 'delve', label: 'Enter an Adventure realm' },
    ],
    rewards: {
      passivePoints: 1,
      houseRenown: 5,
    },
    deed: "Answered Aldwyn's Charge",
  },
];

export const getQuestDefinition = questId => (
  QUEST_DEFINITIONS.find(quest => quest.id === questId) || null
);

export default {
  MAX_QUEST_POINTS,
  QUEST_DEFINITIONS,
  QUEST_SCHEMA_VERSION,
  getQuestDefinition,
};
