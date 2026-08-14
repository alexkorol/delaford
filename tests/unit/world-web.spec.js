/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import chroniclesRepository from '#server/core/repositories/chronicles-repository.js';
import {
  ROADS,
  buildChart,
  getNode,
  getRoadNodes,
  isNodeUnlocked,
  parseNodeId,
} from '#server/core/world-web.js';
import { OUTFIT_TIERS, prestigeRank } from '#server/core/services/wagon-service.js';

const HOUSE = 'house-web-spec';

describe('world web graph', () => {
  it('exposes the four trade roads', () => {
    expect(ROADS.map(road => road.id).sort()).toEqual(['chalk', 'copper', 'salt', 'tin']);
    expect(new Set(ROADS.map(road => road.direction)).size).toBe(4);
  });

  it('is deterministic per house and differs between houses', () => {
    const first = getRoadNodes(HOUSE, 'salt', 6);
    const second = getRoadNodes(HOUSE, 'salt', 6);
    expect(second).toEqual(first);

    const otherHouse = getRoadNodes('house-someone-else', 'salt', 6);
    const names = nodes => nodes.map(node => node.name).join('|');
    expect(names(otherHouse)).not.toBe(names(first));
  });

  it('chains and branches: single tier-1 root, parents own their children', () => {
    ROADS.forEach((road) => {
      const nodes = getRoadNodes(HOUSE, road.id, 8);
      const tier1 = nodes.filter(node => node.tier === 1);
      expect(tier1).toHaveLength(1);
      expect(tier1[0].parentId).toBeNull();

      const byId = new Map(nodes.map(node => [node.id, node]));
      nodes.filter(node => node.tier > 1).forEach((node) => {
        const parent = byId.get(node.parentId);
        expect(parent).toBeTruthy();
        expect(parent.tier).toBe(node.tier - 1);
        expect(parent.childIds).toContain(node.id);
      });

      // Never more onward gates than a zone can hold.
      nodes.forEach(node => expect(node.childIds.length).toBeLessThanOrEqual(3));

      // Names stay unique within the visible chart.
      expect(new Set(nodes.map(node => node.name)).size).toBe(nodes.length);
    });
  });

  it('deepens without limit (lazy generation)', () => {
    const deep = getRoadNodes(HOUSE, 'tin', 40);
    expect(deep.some(node => node.tier === 40)).toBe(true);
  });

  it('parses and resolves node ids', () => {
    const [root] = getRoadNodes(HOUSE, 'chalk', 1);
    expect(parseNodeId(root.id)).toEqual({ roadId: 'chalk', tier: 1, index: 0 });
    expect(parseNodeId('nonsense')).toBeNull();
    expect(parseNodeId('chalk:-1:0')).toBeNull();

    const resolved = getNode(HOUSE, root.id);
    expect(resolved.name).toBe(root.name);
    expect(resolved.wardenName).toBe(`Warden of ${root.name}`);
  });

  it('unlocks tier 1 freely and children only past a dead Warden', () => {
    const nodes = getRoadNodes(HOUSE, 'copper', 2);
    const root = nodes.find(node => node.tier === 1);
    const child = nodes.find(node => node.tier === 2);

    expect(isNodeUnlocked(HOUSE, root.id, [])).toBe(true);
    expect(isNodeUnlocked(HOUSE, child.id, [])).toBe(false);
    expect(isNodeUnlocked(HOUSE, child.id, [root.id])).toBe(true);
  });

  it('builds a chart with cleared/open/barred statuses up to the frontier', () => {
    const nodes = getRoadNodes(HOUSE, 'salt', 2);
    const root = nodes.find(node => node.tier === 1);

    const before = buildChart(HOUSE, 'salt', []);
    expect(before.nodes).toHaveLength(1);
    expect(before.nodes[0].status).toBe('open');

    const after = buildChart(HOUSE, 'salt', [root.id]);
    expect(after.nodes.find(node => node.id === root.id).status).toBe('cleared');
    const children = after.nodes.filter(node => node.tier === 2);
    expect(children.length).toBeGreaterThan(0);
    children.forEach(child => expect(child.status).toBe('open'));
  });
});

describe('house world progress persistence', () => {
  it('stores cleared nodes per house, idempotently', () => {
    const accountId = 'account:world-web';
    const founded = chroniclesRepository.foundHouse(accountId, 'Webwalkers');
    const houseId = founded.houseId;
    const [root] = getRoadNodes(houseId, 'tin', 1);

    expect(chroniclesRepository.getClearedZoneNodes(houseId)).toEqual([]);
    expect(chroniclesRepository.markZoneNodeCleared(houseId, root.id)).toBe(true);
    expect(chroniclesRepository.markZoneNodeCleared(houseId, root.id)).toBe(false);
    expect(chroniclesRepository.getClearedZoneNodes(houseId)).toEqual([root.id]);

    // Unknown house records nothing.
    expect(chroniclesRepository.markZoneNodeCleared('no-such-house', root.id)).toBe(false);
  });

  it('debits the treasury only when the ledger covers it', () => {
    const accountId = 'account:wagon-spend';
    const founded = chroniclesRepository.foundHouse(accountId, 'Spendthrifts');
    const houseId = founded.houseId;
    const scion = chroniclesRepository.createScion(accountId, houseId, 'Spender');
    chroniclesRepository.depositScionGold(accountId, houseId, scion.scionId, 100, { savedAt: 1 });

    const denied = chroniclesRepository.spendHouseTreasury(accountId, houseId, 500);
    expect(denied.ok).toBe(false);

    const approved = chroniclesRepository.spendHouseTreasury(accountId, houseId, 60);
    expect(approved).toEqual({ ok: true, treasury: 40 });
  });
});

describe('wagon outfitting gates', () => {
  it('locks iron and steel behind prestige or the forge', () => {
    const poorHouse = { renown: 0, upgrades: { forge: 0 } };
    const knownHouse = { renown: 600, upgrades: { forge: 0 } };
    const forgeHouse = { renown: 0, upgrades: { forge: 2 } };

    expect(OUTFIT_TIERS[0].unlocked(poorHouse)).toBe(true);
    expect(OUTFIT_TIERS[1].unlocked(poorHouse)).toBe(false);
    expect(OUTFIT_TIERS[1].unlocked(knownHouse)).toBe(true);
    expect(OUTFIT_TIERS[2].unlocked(knownHouse)).toBe(false);
    expect(OUTFIT_TIERS[2].unlocked(forgeHouse)).toBe(true);
  });

  it('ranks prestige in road terms', () => {
    expect(prestigeRank(0)).toBe('Unproven');
    expect(prestigeRank(300)).toBe('Road-Known');
    expect(prestigeRank(5000)).toBe('Renowned');
  });
});
