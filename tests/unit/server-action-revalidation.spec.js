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

import Config from '#server/config.js';
import actionEvents from '#server/player/handlers/actions/index.js';
import Socket from '#server/socket.js';
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

describe('context-menu action revalidation (cand-003)', () => {
  const tile = { x: Config.map.player.x, y: Config.map.player.y };
  let player;

  beforeEach(() => {
    mockUI.getTileOverMouse.mockReturnValue(null);
    mockUI.getContextSubjectColor.mockReturnValue('inherit');
    mockUI.tileWalkable.mockReturnValue(true);
    mockQuery.getItemData.mockImplementation(id => createBaseItem(id));
    mockQuery.getForegroundData.mockReturnValue(null);
    vi.spyOn(Socket, 'emit').mockImplementation(() => {});
    vi.spyOn(Socket, 'broadcast').mockImplementation(() => {});

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

    world.items = [{
      id: 'apple',
      x: player.x,
      y: player.y,
      uuid: 'ground-apple-1',
      timestamp: 5,
      context: 'item',
    }];
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  const buildMenu = async () => {
    await actionEvents['player:context-menu:build']({
      data: {
        player: { socket_id: player.socket_id },
        tile,
        miscData: { clickedOn: { 0: 'gameMap' } },
      },
    });
    const call = Socket.emit.mock.calls.find(entry => entry[0] === 'game:context-menu:items');
    expect(call).toBeTruthy();
    return call[1].data;
  };

  const dispatchAction = (item, socketId = player.socket_id) => actionEvents['player:context-menu:action']({
    data: {
      player: { socket_id: socketId },
      data: { tile, item },
    },
  });

  it('executes a legitimate echoed entry exactly as offered by the server', async () => {
    const items = await buildMenu();
    const examineEntry = items.find(entry => entry.action.actionId === 'player:examine');
    expect(examineEntry).toBeTruthy();

    dispatchAction(examineEntry);

    expect(Socket.emit).toHaveBeenCalledWith('item:examine', expect.objectContaining({
      data: { type: 'normal', text: 'Examine apple' },
    }));
  });

  it('rejects a forged actionId that was never offered for the tile', async () => {
    await buildMenu();

    dispatchAction({
      action: {
        name: 'Trade', actionId: 'player:screen:npc:trade', queueable: false,
      },
      id: 2,
      type: 'npc',
    });

    expect(Socket.emit).not.toHaveBeenCalledWith('open:screen', expect.anything());
    expect(player.currentPane).not.toBe('shop');
  });

  it('rejects any action when no menu was ever built for the socket', () => {
    dispatchAction({
      action: { name: 'Examine', actionId: 'player:examine' },
      id: 'apple',
      type: 'item',
    }, 'socket-never-built');

    expect(Socket.emit).not.toHaveBeenCalledWith('item:examine', expect.anything());
  });

  it('rejects a tampered item identity even when the actionId was offered', async () => {
    const items = await buildMenu();
    const examineEntry = items.find(entry => entry.action.actionId === 'player:examine');

    dispatchAction({ ...examineEntry, id: 'pear' });

    expect(Socket.emit).not.toHaveBeenCalledWith('item:examine', expect.anything());
  });

  it('still ignores Cancel-style entries without an actionId', async () => {
    await buildMenu();

    expect(() => dispatchAction({
      action: {
        name: 'Cancel', actionId: null, queueable: true,
      },
    })).not.toThrow();
    expect(Socket.emit).not.toHaveBeenCalledWith('item:examine', expect.anything());
  });
});
