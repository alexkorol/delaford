import { describe, expect, it } from 'vitest';

import {
  VERDIGRIS_SIGNS,
  VERDIGRIS_SUBTREES,
  VerdigrisGeometricTree,
  createDerivedRows,
  edgeKey,
} from '@/core/passives/verdigris-geometric-tree.js';
import {
  VERDIGRIS_SKILL_TREE_POINTS,
  VERDIGRIS_SKILL_TREE_SOURCES,
  VERDIGRIS_SKILL_TREE_TOTALS,
} from '@/core/passives/verdigris-skill-tree.js';

const allocateFirstChoice = (tree, nodeId) => {
  tree.handleNodeClick(nodeId);
  const pendingChoices = tree.getPendingChoices();
  if (!pendingChoices.length) {
    expect(tree.nodes.get(nodeId).active).toBe(true);
    return null;
  }
  const [choice] = pendingChoices;
  tree.handleConduitClick(choice.conduitId, choice.optionId);
  return choice;
};

describe('Verdigris geometric skill tree model', () => {
  it('builds the nine-ring WIZARD lattice plus gateway subtrees', () => {
    const tree = new VerdigrisGeometricTree();

    const mainNodes = Array.from(tree.nodes.values()).filter(node => node.source === 'main');
    const subtreeNodes = Array.from(tree.nodes.values()).filter(node => node.source === 'subtree');

    expect(mainNodes).toHaveLength(VERDIGRIS_SKILL_TREE_TOTALS.nodes);
    expect(subtreeNodes).toHaveLength(VERDIGRIS_SKILL_TREE_TOTALS.subtreeNodes);
    expect(tree.nodes.get('0,0').active).toBe(true);
    expect(tree.nodes.get('0,0').cost).toBe(0);

    const firstConduit = tree.conduits.values().next().value;
    expect(firstConduit.options.map(option => option.id)).toEqual(['inner', 'outer']);
    expect(firstConduit.options.every(option => option.attrs.STR + option.attrs.DEX + option.attrs.INT > 0)).toBe(true);
  });

  it('uses the unified point economy: one pool, 1 per node and 1 per path', () => {
    const tree = new VerdigrisGeometricTree();
    expect(VERDIGRIS_SKILL_TREE_POINTS.skill).toBe(123);
    expect(VERDIGRIS_SKILL_TREE_SOURCES.levels + VERDIGRIS_SKILL_TREE_SOURCES.quests)
      .toBe(VERDIGRIS_SKILL_TREE_POINTS.skill);

    Array.from(tree.nodes.values()).forEach((node) => {
      expect(node.cost).toBe(node.type === 'origin' ? 0 : 1);
    });

    allocateFirstChoice(tree, '1,0');
    expect(tree.nodes.get('1,0').active).toBe(true);
    expect(tree.points.skill).toBe(VERDIGRIS_SKILL_TREE_POINTS.skill - 2);
    expect(tree.toState().allocatedConduits).toBe(1);
    expect(tree.stats.derived.life).toBeGreaterThanOrEqual(1000);
    expect(tree.log[0]).toContain('Allocated');
  });

  it('places gateways on ring-9 corners and Signs on ring-8 keystones', () => {
    const tree = new VerdigrisGeometricTree();

    VERDIGRIS_SUBTREES.forEach((config) => {
      const gateway = tree.nodes.get(`${config.gateway.q},${config.gateway.r}`);
      expect(gateway.type).toBe('gateway');
      expect(gateway.name).toBe(`${config.title} Gate`);
    });

    const signNames = new Set(VERDIGRIS_SIGNS.map(sign => sign.name));
    const ringEightKeystones = Array.from(tree.nodes.values())
      .filter(node => node.ring === 8 && node.type === 'keystone');
    expect(ringEightKeystones.length).toBeGreaterThan(0);
    ringEightKeystones.forEach((node) => {
      expect(signNames.has(node.name)).toBe(true);
      expect(node.tags).toContain('sign');
    });

    const grandMasteries = Array.from(tree.nodes.values())
      .filter(node => node.ring === 7 && node.type === 'mastery')
      .map(node => node.name);
    expect(grandMasteries.sort()).toEqual(['Acrobat', 'Archmage', 'Champion']);
  });

  it('hides subtree nodes until the gateway is allocated and a loop is closed', () => {
    const tree = new VerdigrisGeometricTree();
    const [config] = VERDIGRIS_SUBTREES;
    const subtreeEntry = tree.nodes.get(config.nodes[0].id);

    expect(tree.isNodeVisible(subtreeEntry)).toBe(false);
    expect(tree.isSubtreeUnlocked(config.id)).toBe(false);
    expect(tree.isAvailableNode(subtreeEntry)).toBe(false);
  });

  it('edits conduit variants without spending another point and supports undo', () => {
    const tree = new VerdigrisGeometricTree();
    allocateFirstChoice(tree, '1,0');

    const conduit = tree.conduits.get(edgeKey('0,0', '1,0'));
    const originalVariant = conduit.allocatedVariant;
    const nextVariant = conduit.options.find(option => option.id !== originalVariant).id;
    const pointsAfterAllocation = tree.points.skill;

    tree.handleConduitClick(conduit.id, conduit.allocatedVariant);
    expect(tree.pending.mode).toBe('conduit');
    tree.handleConduitClick(conduit.id, nextVariant);

    expect(conduit.allocatedVariant).toBe(nextVariant);
    expect(tree.points.skill).toBe(pointsAfterAllocation);

    tree.undo();
    expect(conduit.allocatedVariant).toBe(originalVariant);
    expect(tree.points.skill).toBe(pointsAfterAllocation);
  });

  it('blocks refunds that would disconnect allocated nodes', () => {
    const tree = new VerdigrisGeometricTree();
    allocateFirstChoice(tree, '1,0');
    allocateFirstChoice(tree, '2,0');

    tree.refundNode('1,0');

    expect(tree.nodes.get('1,0').active).toBe(true);
    expect(tree.nodes.get('2,0').active).toBe(true);
    expect(tree.log[0]).toContain('supports another allocated path');
  });

  it('refunds a leaf node and returns its node and path points', () => {
    const tree = new VerdigrisGeometricTree();
    allocateFirstChoice(tree, '1,0');
    const pointsBeforeRefund = tree.points.skill;

    tree.refundNode('1,0');

    expect(tree.nodes.get('1,0').active).toBe(false);
    expect(tree.points.skill).toBe(pointsBeforeRefund + 2);
  });

  it('surfaces derived rows for the in-game details panel', () => {
    const tree = new VerdigrisGeometricTree();
    allocateFirstChoice(tree, '1,0');

    const rows = createDerivedRows(tree.stats.derived);

    expect(rows.map(row => row.key)).toContain('attackDamage');
    expect(rows.find(row => row.key === 'life').value).toMatch(/^\d+/);
  });
});
