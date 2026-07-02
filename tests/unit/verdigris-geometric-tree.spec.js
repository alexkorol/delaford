import { describe, expect, it } from 'vitest';

import {
  VerdigrisGeometricTree,
  createDerivedRows,
  edgeKey,
} from '@/core/passives/verdigris-geometric-tree.js';

const allocateFirstChoice = (tree, nodeId) => {
  tree.handleNodeClick(nodeId);
  const [choice] = tree.getPendingChoices();
  expect(choice).toBeTruthy();
  tree.handleConduitClick(choice.conduitId, choice.optionId);
  return choice;
};

describe('Verdigris geometric skill tree model', () => {
  it('builds the in-game WIZARD-style six-ring tree with conduit variants', () => {
    const tree = new VerdigrisGeometricTree();

    expect(tree.nodes.size).toBe(127);
    expect(tree.nodes.get('0,0').active).toBe(true);
    expect(tree.nodes.get('0,0').cost).toBe(0);
    expect(tree.conduits.size).toBeGreaterThan(250);

    const firstConduit = tree.conduits.values().next().value;
    expect(firstConduit.options.map(option => option.id)).toEqual(['inner', 'outer']);
    expect(firstConduit.options.every(option => option.attrs.STR + option.attrs.DEX + option.attrs.INT > 0)).toBe(true);
  });

  it('allocates nodes through chosen conduits and updates derived stats', () => {
    const tree = new VerdigrisGeometricTree();

    tree.handleNodeClick('1,0');
    expect(tree.pending.mode).toBe('node');
    expect(tree.getPendingChoices()).toHaveLength(2);

    const [choice] = tree.getPendingChoices();
    tree.handleConduitClick(choice.conduitId, choice.optionId);

    expect(tree.nodes.get('1,0').active).toBe(true);
    expect(tree.points.nodes).toBe(35);
    expect(tree.points.conduits).toBe(41);
    expect(tree.toState().allocatedConduits).toBe(1);
    expect(tree.stats.attrs.STR + tree.stats.attrs.DEX + tree.stats.attrs.INT).toBeGreaterThan(0);
    expect(tree.stats.derived.life).toBeGreaterThan(100);
    expect(tree.log[0]).toContain('Allocated');
  });

  it('edits conduit variants without spending another conduit point and supports undo', () => {
    const tree = new VerdigrisGeometricTree();
    allocateFirstChoice(tree, '1,0');

    const conduit = tree.conduits.get(edgeKey('0,0', '1,0'));
    const originalVariant = conduit.allocatedVariant;
    const nextVariant = conduit.options.find(option => option.id !== originalVariant).id;
    const conduitsAfterAllocation = tree.points.conduits;

    tree.handleConduitClick(conduit.id, conduit.allocatedVariant);
    expect(tree.pending.mode).toBe('conduit');
    tree.handleConduitClick(conduit.id, nextVariant);

    expect(conduit.allocatedVariant).toBe(nextVariant);
    expect(tree.points.conduits).toBe(conduitsAfterAllocation);

    tree.undo();
    expect(conduit.allocatedVariant).toBe(originalVariant);
    expect(tree.points.conduits).toBe(conduitsAfterAllocation);
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

  it('surfaces derived rows for the in-game details panel', () => {
    const tree = new VerdigrisGeometricTree();
    allocateFirstChoice(tree, '1,0');

    const rows = createDerivedRows(tree.stats.derived);

    expect(rows.map(row => row.key)).toContain('attackDamage');
    expect(rows.find(row => row.key === 'life').value).toMatch(/^\d+/);
  });
});
