// Unified point economy: nodes and conduits each cost 1 point from a single
// pool, so travel is a real spend. The authored ten-ring tree has a 140-point
// lifetime budget: 117 from levels and 23 from quests.
export const VERDIGRIS_SKILL_TREE_POINTS = Object.freeze({
  skill: 140,
});

export const VERDIGRIS_SKILL_TREE_SOURCES = Object.freeze({
  levels: 117,
  quests: 23,
});

export const VERDIGRIS_SKILL_TREE_TOTALS = Object.freeze({
  layers: 10,
  nodes: 331,
  subtreeNodes: 34,
});
