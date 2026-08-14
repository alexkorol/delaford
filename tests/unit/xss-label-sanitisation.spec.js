/** @vitest-environment node */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const mockUI = vi.hoisted(() => ({
  getContextSubjectColor: vi.fn(),
}));

vi.mock('#shared/ui.js', () => ({
  default: mockUI,
}));

const mockQuery = vi.hoisted(() => ({
  getItemData: vi.fn(),
}));

vi.mock('#server/core/data/query.js', () => ({
  default: mockQuery,
}));

import takeStrategy from '#server/core/context-menu/strategies/take.js';
import examineStrategy from '#server/core/context-menu/strategies/examine.js';
import openScreenStrategy from '#server/core/context-menu/strategies/open-screen.js';
import talkStrategy from '#server/core/context-menu/strategies/talk.js';
import { escapeHtml } from '#shared/html.js';
import chroniclesRepository from '#server/core/repositories/chronicles-repository.js';
import { drawCirculatingRelic } from '#server/core/services/chronicles.js';
import wagonService from '#server/core/services/wagon-service.js';
import world from '#server/core/world.js';

beforeEach(() => {
  mockUI.getContextSubjectColor.mockReturnValue('gold');
  mockQuery.getItemData.mockReturnValue({});
});
afterEach(() => {
  mockUI.getContextSubjectColor.mockReset();
  mockQuery.getItemData.mockReset();
  vi.restoreAllMocks();
});

describe('context-menu label HTML escaping (cand-001/cand-002)', () => {
  it('escapeHtml neutralises every markup metacharacter', () => {
    expect(escapeHtml(`<svg onload=alert('x')>&"`)).toBe(
      '&lt;svg onload=alert(&#39;x&#39;)&gt;&amp;&quot;',
    );
  });

  it('escapes relic display names in Take labels while keeping the rarity span', () => {
    const [entry] = takeStrategy.execute({
      action: { name: 'Take', actionId: 'player:take' },
      menu: { canDoAction: () => true },
      groundItems: [{
        id: 'relic-ring',
        name: 'Sun Ring - Relic of <svg onload=alert()>',
        x: 1,
        y: 1,
        uuid: 'relic-uuid-1',
        timestamp: 1,
        context: 'item',
      }],
    });

    expect(entry.label).toBe(
      `Take <span style='color:gold'>Sun Ring - Relic of &lt;svg onload=alert()&gt;</span>`,
    );
    expect(entry.label).not.toContain('<svg');
  });

  it('keeps legitimate names and colour markup intact in Take labels', () => {
    const [entry] = takeStrategy.execute({
      action: { name: 'Take', actionId: 'player:take' },
      menu: { canDoAction: () => true },
      groundItems: [{
        id: 'ring', name: "Bryn's Ring", x: 1, y: 1, uuid: 'u2', timestamp: 2, context: 'item',
      }],
    });

    expect(entry.label).toBe(`Take <span style='color:gold'>Bryn&#39;s Ring</span>`);
  });

  it('escapes ground-item names in Examine labels', () => {
    const [entry] = examineStrategy.execute({
      action: { name: 'Examine', actionId: 'player:examine' },
      menu: {
        isFromGameCanvas: () => true,
        isFromInventory: () => false,
        canDoAction: () => true,
      },
      groundItems: [{
        id: 'relic-ring', name: '<img src=x onerror=alert(1)>', context: 'item', actions: ['examine'], x: 1, y: 1,
      }],
    });

    expect(entry.label).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(entry.label).not.toContain('<img');
  });

  it('escapes inventory display names in Examine labels', () => {
    const [entry] = examineStrategy.execute({
      action: { name: 'Examine', actionId: 'player:examine' },
      menu: {
        isFromGameCanvas: () => false,
        isFromInventory: () => true,
        canDoAction: () => true,
      },
      selectedItemData: {
        id: 'relic', name: 'Base', context: 'item', actions: ['examine'],
      },
      dynamicItem: { id: 'relic', name: 'Relic of <b>evil</b>', examine: 'x' },
    });

    expect(entry.label).toContain('Relic of &lt;b&gt;evil&lt;/b&gt;');
  });

  it('escapes wagon NPC names in open-screen labels', () => {
    const [entry] = openScreenStrategy.execute({
      action: { name: 'Wagon', actionId: 'player:screen:wagon' },
      menu: { isFromGameCanvas: () => true, canDoAction: () => true },
      npcs: [{
        id: 'wagon-1', name: 'House <svg onload=alert()> Wagon', context: 'npc', actions: ['wagon'], examine: 'x',
      }],
    });

    expect(entry.label).toBe(
      `Wagon <span style='color:gold'>House &lt;svg onload=alert()&gt; Wagon</span>`,
    );
  });

  it('escapes NPC names in Examine and Talk labels', () => {
    const npc = {
      id: 7, name: '<i>tricky</i> guide', context: 'npc', actions: ['examine', 'talk'], examine: 'x',
    };
    const [examineEntry] = examineStrategy.execute({
      action: { name: 'Examine', actionId: 'player:examine' },
      menu: {
        isFromGameCanvas: () => true,
        isFromInventory: () => false,
        canDoAction: () => true,
      },
      npcs: [npc],
    });
    const [talkEntry] = talkStrategy.execute({
      action: { name: 'Talk-to', actionId: 'player:npc:talk' },
      menu: { canDoAction: () => true },
      npcs: [npc],
    });

    expect(examineEntry.label).toContain('&lt;i&gt;tricky&lt;/i&gt; guide');
    expect(talkEntry.label).toContain('&lt;i&gt;tricky&lt;/i&gt; guide');
  });
});

describe('legacy persisted names are neutralised before reaching labels', () => {
  it('sanitises pre-validation scion names when a relic circulates', () => {
    const accountId = 'account:legacy-relic';
    const founded = chroniclesRepository.foundHouse(accountId, 'Legacyhouse');
    expect(founded.ok).toBe(true);
    chroniclesRepository.db.prepare(`
      INSERT INTO chronicle_relics (
        id, house_id, source_scion_id, origin_scion_name, item_json,
        status, eligible_run, created_at
      ) VALUES (?, ?, ?, ?, ?, 'circulating', 0, ?)
    `).run(
      'relic-legacy-1',
      founded.houseId,
      'scion-legacy-1',
      '<svg onload=alert()>',
      JSON.stringify({ id: 'gold-ring', uuid: 'legacy-ring-1' }),
      new Date().toISOString(),
    );

    const item = drawCirculatingRelic([{ accountId }]);

    expect(item).not.toBeNull();
    expect(item.name).not.toMatch(/[<>]/);
    expect(item.name).not.toContain('onload=');
    expect(item.name).toContain('Relic of');
    expect(item.legacy.sourceScionName).not.toMatch(/[<>]/);
  });

  it('sanitises pre-validation House names when naming the shared wagon NPC', () => {
    const addNpc = vi.spyOn(world, 'addNpc').mockImplementation(() => {});

    const record = wagonService.ensureWagon('house-legacy-xss', '<img src=x onerror=alert(1)>');

    expect(record).not.toBeNull();
    const npc = addNpc.mock.calls[0][0];
    expect(npc.name).not.toMatch(/[<>]/);
    expect(npc.name).toMatch(/^House .+ Wagon$/);
    wagonService.wagons.delete('house-legacy-xss');
  });
});
