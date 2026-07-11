const FIRST_GOAL_PRESENTATION = {
  available: {
    status: 'Available',
    objective: 'Speak with Aldwyn the Guide in Delaford.',
  },
  'clear-floor': {
    status: 'In progress',
    objective: 'Clear The Old Barrow · Floor 1.',
  },
  'return-to-town': {
    status: 'Return',
    objective: 'Return to Aldwyn in Delaford.',
  },
  complete: {
    status: 'Complete',
    objective: 'The Old Barrow has been cleared.',
    completed: true,
  },
};

export const presentFirstGoal = (goal = {}) => ({
  title: 'A Stirring in the Barrow',
  reward: '1 Verdigris point',
  completed: false,
  ...(FIRST_GOAL_PRESENTATION[goal.stage] || FIRST_GOAL_PRESENTATION.available),
});

export default { presentFirstGoal };
