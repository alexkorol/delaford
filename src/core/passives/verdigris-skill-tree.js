// Unified point economy: nodes and conduits each cost 1 point from a single
// pool, so travel is a real spend. 123 points at max: 100 from levels,
// 23 from quests (~61 node+path steps of the 271-node lattice).
export const VERDIGRIS_SKILL_TREE_POINTS = Object.freeze({
  skill: 123,
});

export const VERDIGRIS_SKILL_TREE_SOURCES = Object.freeze({
  levels: 100,
  quests: 23,
});

export const VERDIGRIS_SKILL_TREE_TOTALS = Object.freeze({
  layers: 9,
  nodes: 271,
  subtreeNodes: 34,
});
