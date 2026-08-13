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
  {
    id: 'proof-of-temper',
    title: 'Proof of Temper',
    description: 'Bring down an Adventure guardian, claim the Vessel it yields, and make its strength your own.',
    objectives: [
      { id: 'slay-elite', trigger: 'slay-elite', label: 'Defeat an elite Adventure guardian' },
      { id: 'loot-vessel', trigger: 'loot-vessel', label: "Claim the guardian's Vessel" },
      { id: 'equip-vessel', trigger: 'equip-vessel', label: 'Equip the recovered Vessel' },
    ],
    rewards: {
      passivePoints: 1,
      houseRenown: 10,
    },
    deed: 'Proved their temper in the old realms',
  },
  {
    id: 'the-pale-crown',
    title: 'The Pale Crown',
    description: 'Break the sovereign seal in Weir Crypt and follow the opened road into the deeper realm.',
    objectives: [
      {
        id: 'enter-weir-crypt',
        trigger: 'delve',
        label: 'Enter Weir Crypt',
        criteria: { zoneId: 'weir-crypt', depth: 1 },
      },
      {
        id: 'slay-pale-sovereign',
        trigger: 'slay-elite',
        label: 'Defeat the Pale Sovereign',
        criteria: { monsterName: 'The Pale Sovereign', theme: 'crypt' },
      },
      {
        id: 'descend-beneath-seal',
        trigger: 'delve',
        label: 'Descend to the second floor',
        criteria: { template: 'crypt', minDepth: 2 },
      },
    ],
    rewards: {
      passivePoints: 1,
      houseRenown: 15,
    },
    deed: "Broke the Pale Sovereign's seal",
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
