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
  tileWalkable: vi.fn(),
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
import Action from '#server/player/action.js';
import actionEvents from '#server/player/handlers/actions/index.js';
import world from '#server/core/world.js';

const DEFAULT_ACTIONS = [
  'drop',
  'equip',
  'examine',
  'take',
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

const resetNonDefaultScenes = () => {
  Array.from(world.scenes.keys())
    .filter(sceneId => sceneId !== world.defaultTownId)
    .forEach(sceneId => world.scenes.delete(sceneId));
  world.instances.clear();
};

let player;

beforeEach(() => {
  mockUI.getTileOverMouse.mockReturnValue(null);
  mockUI.getContextSubjectColor.mockReturnValue('inherit');
  mockUI.tileWalkable.mockReturnValue(true);
  mockQuery.getItemData.mockImplementation(id => createBaseItem(id));
  mockQuery.getForegroundData.mockReturnValue(null);

  world.players.splice(0, world.players.length);
  world.npcs = [];
  world.items = [];
  world.shops = [];
  world.map = { foreground: [], background: [] };
  world.getDefaultTown().players = [];
  resetNonDefaultScenes();

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
  mockUI.tileWalkable.mockReset();
  mockQuery.getItemData.mockReset();
  mockQuery.getForegroundData.mockReset();

  world.players.splice(0, world.players.length);
  world.npcs = [];
  world.items = [];
  world.shops = [];
  world.getDefaultTown().players = [];
  resetNonDefaultScenes();
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

  it('surfaces the town brand service for vessel items with capacity', async () => {
    player.inventory.slots = [{
      slot: 0,
      id: 'bronze-pike',
      name: 'Bronze Pike',
      uuid: 'vessel-pike',
      vessel: {
        item: {
          vessel: 4,
          patience: 3,
          brands: [],
          bonds: [],
          trophies: [],
          scars: 0,
        },
      },
    }];

    const menu = new ContextMenu(player, tile, {
      clickedOn: { 0: 'inventorySlot' },
      slot: 0,
    });
    const actions = await menu.build();

    expect(actions.find(entry => entry.action.actionId === 'player:vesselforge:add-brand'))
      .toMatchObject({ label: 'Add a random brand (100 coins)', uuid: 'vessel-pike' });
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

  it('offers fountain healing at the Crossroads fountain', async () => {
    const miscData = { clickedOn: { 0: 'gameMap' } };
    const menu = new ContextMenu(player, {
      x: 0,
      y: 0,
      world: { x: 38, y: 115 },
    }, miscData);
    const actions = await menu.build();

    expect(actions.find(entry => entry.action.actionId === 'player:fountain:drink')).toMatchObject({
      label: 'Drink from the Crossroads Fountain',
      id: 'crossroads-fountain',
    });
  });

  it('opens shop displays for trade without offering Take', async () => {
    world.items = [{
      id: 'bronze-sword',
      x: player.x,
      y: player.y,
      uuid: 'display-sword',
      shopDisplay: true,
      shopNpcId: 2,
    }];
    world.shops = [{ npcId: 2, name: 'General Store', inventory: [] }];
    const miscData = { clickedOn: { 0: 'gameMap' } };
    const menu = new ContextMenu(player, tile, miscData);
    const actions = await menu.build();

    expect(actions.find(entry => entry.action.actionId === 'player:screen:shop-display')).toMatchObject({
      id: 2,
      shopItemId: 'bronze-sword',
    });
    expect(actions.find(entry => entry.action.actionId === 'player:shop-display:buy')).toMatchObject({
      id: 2,
      shopItemId: 'bronze-sword',
    });
    expect(actions.find(entry => entry.action.actionId === 'player:shop-display:appraise')).toMatchObject({
      id: 2,
      shopItemId: 'bronze-sword',
    });
    expect(actions.some(entry => entry.action.actionId === 'player:take')).toBe(false);
  });

  it('produces take options from the active scene instead of default town items', async () => {
    const scene = world.ensureScene('zone:context-menu-test', {
      map: { foreground: [], background: [] },
      items: [{
        id: 4,
        x: player.x,
        y: player.y,
        uuid: 'scene-ground-uuid',
        timestamp: 222,
      }],
      respawns: { items: [], monsters: [], resources: [] },
    });
    world.items = [{
      id: 5,
      x: player.x,
      y: player.y,
      uuid: 'town-ground-uuid',
      timestamp: 111,
    }];
    world.assignPlayerToScene(player, scene.id);

    const miscData = { clickedOn: { 0: 'gameMap' } };
    const menu = new ContextMenu(player, tile, miscData);
    const actions = await menu.build();

    const takeActions = actions.filter(entry => entry.action.actionId === 'player:take');
    expect(takeActions).toHaveLength(1);
    expect(takeActions[0].id).toBe(4);
    expect(takeActions[0].uuid).toBe('scene-ground-uuid');
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

  it('selects bank and shop items from the clicked pane rather than the same inventory slot', async () => {
    player.inventory.slots = [{ slot: 0, id: 'inventory-item' }];
    player.bank = [{ slot: 0, id: 'bank-item' }];
    player.currentPane = 'bank';

    const bankMenu = new ContextMenu(player, tile, {
      clickedOn: { 3: 'bankSlot' },
      slot: 0,
    });
    const bankActions = await bankMenu.build();
    expect(bankActions.find(entry => entry.action.name === 'Withdraw')?.id).toBe('bank-item');

    world.shops = [{
      npcId: 2,
      inventory: [{ slot: 0, id: 'shop-item' }],
    }];
    player.objectId = 2;
    player.currentPane = 'shop';
    const shopMenu = new ContextMenu(player, tile, {
      clickedOn: { 3: 'shopSlot' },
      slot: 0,
    });
    const shopActions = await shopMenu.build();
    expect(shopActions.find(entry => entry.action.name === 'Buy')?.id).toBe('shop-item');
  });

  it('does not use stale pane data after a pane has been closed', async () => {
    player.currentPane = false;
    player.currentPaneData = [{
      slot: 0,
      id: 3,
      name: 'Stale Bank Item',
      uuid: 'stale-bank-item',
    }];
    player.inventory.slots = [];

    const miscData = {
      clickedOn: { 0: 'inventorySlot' },
      slot: 0,
    };

    const menu = new ContextMenu(player, tile, miscData);
    const actions = await menu.build();

    expect(actions.some(entry => entry.uuid === 'stale-bank-item')).toBe(false);
    expect(actions.filter(entry => entry.action.actionId === 'item:equip')).toHaveLength(0);
    expect(actions.filter(entry => entry.action.actionId === 'player:inventory-drop')).toHaveLength(0);
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

  it('handles immediate current-tile actions without a queue payload', () => {
    const action = new Action(player.socket_id, { clickedOn: { 0: 'gameMap' } });

    expect(() => action.do({
      tile: {
        x: Config.map.player.x,
        y: Config.map.player.y,
      },
      item: {
        action: {
          name: 'Cancel',
          actionId: null,
          queueable: true,
          nearby: false,
        },
      },
    }, null)).not.toThrow();
  });

  it('executes an explicit current-world-tile action without pathing away', () => {
    const take = vi.spyOn(actionEvents, 'player:take').mockImplementation(() => {});
    const action = new Action(player.socket_id, { clickedOn: { 0: 'gameMap' } });
    const queuedAction = {
      action: { actionId: 'player:take' },
      item: { id: 'apple', uuid: 'item-apple' },
      at: { x: player.x, y: player.y },
      queueable: true,
    };

    action.do({
      tile: {
        x: 0,
        y: 0,
        world: { x: player.x, y: player.y },
      },
      item: {
        id: 'apple',
        action: {
          name: 'Take',
          actionId: 'player:take',
          queueable: true,
          nearby: 'edge',
        },
      },
    }, queuedAction);

    expect(queuedAction.queueable).toBe(true);
    expect(take).toHaveBeenCalledTimes(1);
    expect(take).toHaveBeenCalledWith(expect.objectContaining({
      todo: expect.objectContaining({
        item: expect.objectContaining({ id: 'apple' }),
        action: { actionId: 'player:take' },
      }),
    }));
  });

  it('ignores malformed context-menu action payloads without reaching Action', () => {
    const malformed = [
      {},
      { data: {} },
      { data: { player: { socket_id: player.socket_id }, data: {} } },
      {
        data: {
          player: { socket_id: player.socket_id },
          data: { tile, item: { action: null } },
        },
      },
    ];

    malformed.forEach((payload) => {
      expect(() => actionEvents['player:context-menu:action'](payload)).not.toThrow();
    });
    expect(player.queue).toBeUndefined();
  });
});
