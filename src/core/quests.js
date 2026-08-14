const FIRST_GOAL_PRESENTATION = {
  available: {
    status: 'Available',
    objective: 'Speak with Aldwyn the Guide at the Crossroads.',
  },
  'clear-floor': {
    status: 'In progress',
    objective: 'Put down the Warden of any first stretch on your chart.',
  },
  'return-to-town': {
    status: 'Return',
    objective: 'Return to Aldwyn at the Crossroads.',
  },
  complete: {
    status: 'Complete',
    objective: 'Your first Warden is down and the deed is marked.',
    completed: true,
  },
};

export const presentFirstGoal = (goal = {}) => ({
  title: 'No Road Past a Living Warden',
  reward: '1 Verdigris point',
  completed: false,
  ...(FIRST_GOAL_PRESENTATION[goal.stage] || FIRST_GOAL_PRESENTATION.available),
});

export default { presentFirstGoal };
