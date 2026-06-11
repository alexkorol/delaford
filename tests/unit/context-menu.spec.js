import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const mockUI = vi.hoisted(() => ({
  getTileOverMouse: vi.fn(),
  getContextSubjectColor: vi.fn(),
}));

vi.mock('#shared/ui.js', () => ({
  default: mockUI,
}));

const mockQuery = vi.hoisted(() => ({
  getItemData: vi.fn(),
  getForegroundData: vi.fn(),
}));

vi.mock('#server/core/data/query.js', () => ({
  default: mockQuery,
}));

import ContextMenu, { actionCatalog } from '#server/core/context-menu.js';
import Config from '#server/config.js';
import world from '#server/core/world.js';

const DEFAULT_ACTIONS = [
  'drop',
  'equip',
  'examine',
  'take',
  'mine',
  'smelt',
  'deposit',
  'withdraw',
  'buy',
  'sell',
];

const createBaseItem = (id) => ({
  id,
  uuid: `item-${id}`,
  name: `Item ${id}`,
  examine: `Examine ${id}`,
  context: 'item',
  actions: [...DEFAULT_ACTIONS],
});

let player;

beforeEach(() => {
  mockUI.getTileOverMouse.mockReturnValue(null);
  mockUI.getContextSubjectColor.mockReturnValue('inherit');
  mockQuery.getItemData.mockImplementation(id => createBaseItem(id));
  mockQuery.getForegroundData.mockReturnValue(null);

  world.players.splice(0, world.players.length);
  world.npcs = [];
  world.items = [];
  world.shops = [];
  world.map = { foreground: [], background: [] };

  player = {
    socket_id: 'socket-1',
    uuid: 'player-1',
    x: 10,
    y: 10,
    inventory: { slots: [] },
    bank: [],
    wear: [],
    currentPane: null,
    currentPaneData: null,
  };

  world.addPlayer(player);
});

afterEach(() => {
  mockUI.getTileOverMouse.mockReset();
  mockUI.getContextSubjectColor.mockReset();
  mockQuery.getItemData.mockReset();
  mockQuery.getForegroundData.mockReset();

  world.players.splice(0, world.players.length);
  world.npcs = [];
  world.items = [];
  world.shops = [];
});

describe('ContextMenu strategies', () => {
  const tile = { x: Config.map.player.x, y: Config.map.player.y };

  it('includes the walk-here option when clicking on the game map', async () => {
    const miscData = { clickedOn: { 0: 'gameMap' } };
    const menu = new ContextMenu(player, tile, miscData);
    const actions = await menu.build();

    const walkHere = actions.find(entry => entry.action.actionId === 'player:walk-here');
    expect(walkHere).toBeTruthy();
    expect(walkHere.label).toBe('Walk here');
  });

  it('creates a drop action using dynamic item data from the inventory slot', async () => {
    player.inventory.slots = [{
      slot: 0,
      id: 1,
      name: 'Dynamic Item',
      uuid: 'dynamic-uuid',
    }];

    const miscData = {
      clickedOn: { 0: 'inventorySlot' },
      slot: 0,
    };

    const menu = new ContextMenu(player, tile, miscData);
    const actions = await menu.build();

    const dropAction = actions.find(entry => entry.action.actionId === 'player:inventory-drop');
    expect(dropAction).toBeTruthy();
    expect(dropAction.uuid).toBe('dynamic-uuid');
    expect(dropAction.label).toContain('Dynamic Item');
    expect(dropAction.type).toBe('item');
  });

  it('produces take options for ground items at the clicked location', async () => {
    world.items = [{
      id: 2,
      x: player.x,
      y: player.y,
      uuid: 'ground-uuid',
      timestamp: 123,
    }];

    const miscData = { clickedOn: { 0: 'gameMap' } };
    const menu = new ContextMenu(player, tile, miscData);
    const actions = await menu.build();

    const takeActions = actions.filter(entry => entry.action.actionId === 'player:take');
    expect(takeActions).toHaveLength(1);
    expect(takeActions[0].id).toBe(2);
    expect(takeActions[0].uuid).toBe('ground-uuid');
    expect(takeActions[0].type).toBe('item');
  });

  it('generates bank quantity options while on the bank pane', async () => {
    player.currentPane = 'bank';
    player.inventory.slots = [{ slot: 0, id: 3 }];

    const miscData = {
      clickedOn: { 0: 'inventorySlot' },
      slot: 0,
    };

    const menu = new ContextMenu(player, tile, miscData);
    const actions = await menu.build();

    const bankActions = actions.filter(entry => entry.action.actionId === 'player:screen:bank:action');
    expect(bankActions).toHaveLength(4);
    expect(bankActions.map(entry => entry.params.quantity)).toEqual([1, 5, 10, 'All']);
  });

  it('exposes an action catalog entry for each strategy', () => {
    expect(actionCatalog['player:inventory-drop']).toContain('Drop');
    expect(actionCatalog['player:walk-here']).toContain('Move');
    expect(actionCatalog['player:screen:bank:action']).toContain('Transfer');
  });

  it('sorts actions by weight then timestamp', async () => {
    world.items = [
      { id: 10, x: player.x, y: player.y, uuid: 'first-uuid', timestamp: 100 },
      { id: 11, x: player.x, y: player.y, uuid: 'second-uuid', timestamp: 200 },
    ];

    const miscData = { clickedOn: { 0: 'gameMap' } };
    const menu = new ContextMenu(player, tile, miscData);
    const actions = await menu.build();

    expect(Array.isArray(actions)).toBe(true);

    for (let i = 1; i < actions.length; i += 1) {
      const prev = actions[i - 1].action.weight;
      const curr = actions[i].action.weight;
      expect(prev).toBeLessThanOrEqual(curr);
    }
  });

  it('returns empty list when no matching context', async () => {
    const miscData = { clickedOn: {} };
    const menu = new ContextMenu(player, tile, miscData);
    const actions = await menu.build();

    expect(Array.isArray(actions)).toBe(true);
    expect(actions).toHaveLength(0);
  });

  it('does not produce take actions for items far from the player', async () => {
    world.items = [{
      id: 2,
      x: player.x + 100,
      y: player.y + 100,
      uuid: 'far-away-uuid',
      timestamp: 123,
    }];

    const miscData = { clickedOn: { 0: 'gameMap' } };
    const menu = new ContextMenu(player, tile, miscData);
    const actions = await menu.build();

    const takeActions = actions.filter(entry => entry.action.actionId === 'player:take');
    expect(takeActions).toHaveLength(0);
  });
});
