import { VerdigrisGeometricTree } from '../../../src/core/passives/verdigris-geometric-tree.js';
import {
  VERDIGRIS_SKILL_TREE_POINTS,
  VERDIGRIS_SKILL_TREE_SOURCES,
} from '../../../src/core/passives/verdigris-skill-tree.js';

export const earnedVerdigrisPoints = level => Math.min(
  VERDIGRIS_SKILL_TREE_POINTS.skill,
  Math.min(
    Math.max(2, Math.floor(Number(level) || 1)),
    VERDIGRIS_SKILL_TREE_SOURCES.levels,
  ),
);

const reject = reason => ({ ok: false, reason });

/**
 * Rebuild and validate a client allocation against the canonical 271-node
 * graph. The server owns the point budget, adjacency, conduit variants, and
 * resulting attributes; snapshots are no longer trusted save blobs.
 */
export const resolveVerdigrisTree = (incoming, level = 1) => {
  if (!incoming || !Array.isArray(incoming.nodes) || !Array.isArray(incoming.conduits)) {
    return reject('Malformed passive tree.');
  }

  const earned = earnedVerdigrisPoints(level);
  const tree = new VerdigrisGeometricTree({ availablePoints: earned });
  const nodes = [...new Set(incoming.nodes.filter(id => typeof id === 'string'))];
  if (!nodes.includes('0,0')) return reject('The passive tree must include its origin.');
  if (nodes.some(id => !tree.nodes.has(id))) return reject('The passive tree contains an unknown node.');

  const conduitIds = new Set();
  const conduits = [];
  for (const entry of incoming.conduits) {
    if (!entry || typeof entry.id !== 'string' || conduitIds.has(entry.id)) {
      return reject('The passive tree contains a duplicate or malformed conduit.');
    }
    const conduit = tree.conduits.get(entry.id);
    if (!conduit || !conduit.getOption(entry.variant)) {
      return reject('The passive tree contains an unknown conduit choice.');
    }
    conduitIds.add(entry.id);
    conduits.push({ id: entry.id, variant: entry.variant });
  }

  const active = new Set(nodes);
  if (conduits.some((entry) => {
    const conduit = tree.conduits.get(entry.id);
    return !active.has(conduit.fromId) || !active.has(conduit.toId);
  })) {
    return reject('Allocated conduits must join allocated nodes.');
  }

  const spent = nodes.filter(id => id !== '0,0').length + conduits.length;
  if (spent > earned) return reject('The passive tree spends more points than this scion has earned.');

  tree.restore({
    nodes,
    conduits,
    points: { skill: earned - spent },
    log: [],
    selectedNodeId: active.has(incoming.selectedNodeId) ? incoming.selectedNodeId : '0,0',
  });
  const reachable = tree.reachableFromOrigin({});
  if (nodes.some(id => !reachable.has(id))) return reject('Every passive must connect to the origin.');
  if (nodes.some((id) => {
    const node = tree.nodes.get(id);
    return node.source === 'subtree' && !tree.isNodeVisible(node);
  })) {
    return reject('A locked outer circle cannot be allocated.');
  }

  return {
    ok: true,
    snapshot: {
      nodes,
      conduits,
      points: { skill: earned - spent },
      earned,
      selectedNodeId: active.has(incoming.selectedNodeId) ? incoming.selectedNodeId : '0,0',
    },
    attributes: {
      strength: tree.stats.attrs.STR,
      dexterity: tree.stats.attrs.DEX,
      intelligence: tree.stats.attrs.INT,
    },
    stats: tree.stats,
  };
};

export default { earnedVerdigrisPoints, resolveVerdigrisTree };
