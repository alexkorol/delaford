import { describe, expect, it } from 'vitest';

import {
  VERDIGRIS_CLASS_UNLOCKS,
  VERDIGRIS_PASSIVE_TREE_SCHEMA_VERSION,
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
import AUTHORED_TREE_DATA from '@/core/passives/verdigris-authored-tree-data.js';

// Most tests need a spendable pool; a fresh character has none (see the
// "level scaling" block). Give allocation tests the full cap.
const makeTree = (availablePoints = VERDIGRIS_SKILL_TREE_POINTS.skill) => (
  new VerdigrisGeometricTree({ availablePoints })
);

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
  it('builds the authored ten-ring WIZARD lattice plus gateway subtrees', () => {
    const tree = makeTree();

    const mainNodes = Array.from(tree.nodes.values()).filter(node => node.source === 'main');
    const subtreeNodes = Array.from(tree.nodes.values()).filter(node => node.source === 'subtree');

    expect(mainNodes).toHaveLength(VERDIGRIS_SKILL_TREE_TOTALS.nodes);
    expect(subtreeNodes).toHaveLength(VERDIGRIS_SKILL_TREE_TOTALS.subtreeNodes);
    expect(tree.nodes.get('0,0').active).toBe(true);
    expect(tree.nodes.get('0,0').cost).toBe(0);
    expect(tree.nodes.get('0,0').name).toBe('Origin');

    const firstConduit = tree.conduits.values().next().value;
    expect(firstConduit.options.map(option => option.id)).toEqual(['inner', 'outer']);
    expect(firstConduit.options.every(option => option.attrs.STR + option.attrs.DEX + option.attrs.INT > 0)).toBe(true);
  });

  it('uses every imported authored seat without procedural fallback content', () => {
    const tree = makeTree();
    const seats = Object.values(AUTHORED_TREE_DATA.seats);
    expect(seats).toHaveLength(331);
    expect(new Set(seats.map(seat => seat.name)).size).toBe(331);
    seats.forEach((seat) => {
      const node = tree.nodes.get(seat.id);
      expect(node).toBeTruthy();
      expect(node.name).toBe(seat.name);
      expect(node.type).toBe(seat.type === 'gateway' ? 'gateway' : seat.type);
    });
    expect(Array.from(tree.nodes.values()).some(node => node.name.startsWith('Unauthored Seat'))).toBe(false);
  });

  it('uses the unified point economy: one pool, 1 per node and 1 per path', () => {
    const tree = makeTree();
    expect(VERDIGRIS_SKILL_TREE_POINTS.skill).toBe(140);
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

  it('allocates the exact route in one click on its conduit variant', () => {
    const tree = makeTree();
    const conduit = tree.conduits.get(edgeKey('0,0', '1,0'));
    const chosen = conduit.options.find(option => option.id === 'outer');

    expect(tree.isAvailableConduit(conduit, chosen.id)).toBe(true);
    tree.handleConduitClick(conduit.id, chosen.id);

    expect(tree.nodes.get('1,0').active).toBe(true);
    expect(conduit.allocatedVariant).toBe(chosen.id);
    expect(tree.pending).toBe(null);
    expect(tree.points.skill).toBe(VERDIGRIS_SKILL_TREE_POINTS.skill - 2);
  });

  it('starts a fresh level-1 character with zero skill points', () => {
    const tree = new VerdigrisGeometricTree();
    expect(tree.points.skill).toBe(0);
    expect(tree.isAvailableNode(tree.nodes.get('1,0'))).toBe(false);

    tree.handleNodeClick('1,0');
    expect(tree.nodes.get('1,0').active).toBe(false);
  });

  it('grants points as the character levels and preserves what was already spent', () => {
    const tree = new VerdigrisGeometricTree({ availablePoints: 0 });
    tree.setAvailablePoints(2); // reached level 3
    expect(tree.points.skill).toBe(2);
    expect(tree.isAvailableNode(tree.nodes.get('1,0'))).toBe(true);

    allocateFirstChoice(tree, '1,0'); // spends 2 (node + path)
    expect(tree.points.skill).toBe(0);

    tree.setAvailablePoints(4); // levelled up twice more
    expect(tree.points.skill).toBe(2); // 4 earned - 2 already spent
    expect(tree.nodes.get('1,0').active).toBe(true);
  });

  it('does not put the biased conduit point on the far axis', () => {
    // Regression: the secondary bonus used to be the far axis (a STR-leaning
    // conduit granting INT). It must be the option's second-highest-weight
    // axis, never the lowest.
    const tree = makeTree();
    tree.conduits.forEach((conduit) => {
      conduit.options.forEach((option) => {
        const ordered = Object.entries(option.weights)
          .sort((a, b) => b[1] - a[1])
          .map(([key]) => key);
        const secondary = ordered[1];
        const tertiary = ordered[2];
        expect(option.attrs[secondary]).toBeGreaterThanOrEqual(option.attrs[tertiary]);
      });
    });
  });

  it('places gateways on ring-10 corners, authored Signs, and six class milestones', () => {
    const tree = makeTree();

    VERDIGRIS_SUBTREES.forEach((config) => {
      const gateway = tree.nodes.get(`${config.gateway.q},${config.gateway.r}`);
      expect(gateway.type).toBe('gateway');
      expect(gateway.name).toBe(`${config.title} Gate`);
    });

    const signNames = new Set(VERDIGRIS_SIGNS.map(sign => sign.name));
    const ringEightSigns = Array.from(tree.nodes.values())
      .filter(node => node.ring === 8 && node.type === 'sign');
    expect(ringEightSigns).toHaveLength(6);
    ringEightSigns.forEach((node) => {
      expect(signNames.has(node.name)).toBe(true);
    });

    const classMilestones = Array.from(tree.nodes.values())
      .filter(node => node.ring === 7 && node.type === 'class')
      .map(node => node.name);
    expect(classMilestones.sort()).toEqual([
      'Acrobat',
      'Archmage',
      'Champion',
      'Nightblade',
      'Reaver',
      'Ritualist',
    ]);
  });

  it('preserves calling order while every active class milestone contributes unlocks', () => {
    const tree = makeTree();
    tree.restore({
      nodes: ['0,0', '0,-7', '-7,7'],
      conduits: [],
      points: { skill: 136 },
      log: [],
      selectedNodeId: '0,0',
      classOrder: ['-7,7', '0,-7'],
    });

    expect(tree.stats.characterClass).toBe('Champion');
    expect(tree.stats.unlocks).toEqual(expect.arrayContaining([
      ...VERDIGRIS_CLASS_UNLOCKS.Champion,
      ...VERDIGRIS_CLASS_UNLOCKS.Acrobat,
    ]));
    expect(tree.snapshot()).toMatchObject({
      schemaVersion: VERDIGRIS_PASSIVE_TREE_SCHEMA_VERSION,
      classOrder: ['-7,7', '0,-7'],
    });
  });

  it('hides subtree nodes until the gateway is allocated and a loop is closed', () => {
    const tree = makeTree();
    const [config] = VERDIGRIS_SUBTREES;
    const subtreeEntry = tree.nodes.get(config.nodes[0].id);

    expect(tree.isNodeVisible(subtreeEntry)).toBe(false);
    expect(tree.isSubtreeUnlocked(config.id)).toBe(false);
    expect(tree.isAvailableNode(subtreeEntry)).toBe(false);
  });

  it('edits conduit variants without spending another point and supports undo', () => {
    const tree = makeTree();
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
    const tree = makeTree();
    allocateFirstChoice(tree, '1,0');
    allocateFirstChoice(tree, '2,0');

    tree.refundNode('1,0');

    expect(tree.nodes.get('1,0').active).toBe(true);
    expect(tree.nodes.get('2,0').active).toBe(true);
    expect(tree.log[0]).toContain('supports another allocated path');
  });

  it('refunds a leaf node and returns its node and path points', () => {
    const tree = makeTree();
    allocateFirstChoice(tree, '1,0');
    const pointsBeforeRefund = tree.points.skill;

    tree.refundNode('1,0');

    expect(tree.nodes.get('1,0').active).toBe(false);
    expect(tree.points.skill).toBe(pointsBeforeRefund + 2);
  });

  it('surfaces derived rows for the in-game details panel', () => {
    const tree = makeTree();
    allocateFirstChoice(tree, '1,0');

    const rows = createDerivedRows(tree.stats.derived);

    expect(rows.map(row => row.key)).toContain('attackDamage');
    expect(rows.find(row => row.key === 'life').value).toMatch(/^\d+/);
  });
});
