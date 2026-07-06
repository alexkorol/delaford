import Config from '#server/config.js';
import UI from '#shared/ui.js';
import Query from './data/query.js';
import actionList from './data/action-list.js';
import world from './world.js';
import { getStrategy } from './context-menu/strategies/registry.js';

class ContextMenu {
  constructor(player, tile, miscData) {
    // Player
    this.player = world.players.find(p => p.socket_id === player.socket_id);
    this.scene = this.player
      ? world.getSceneForPlayer(this.player)
      : world.getDefaultTown();

    this.tileData = tile;
    this.tile = tile;

    // Map layers
    const mapLayers = this.scene && this.scene.map ? this.scene.map : world.map;
    this.background = mapLayers.background;
    this.foreground = mapLayers.foreground;

    // Moving map objects (npcs, items, etc.)
    this.npcs = this.scene && Array.isArray(this.scene.npcs)
      ? this.scene.npcs
      : world.npcs;
    this.droppedItems = this.scene && Array.isArray(this.scene.items)
      ? this.scene.items
      : world.items;
    this.shops = world.shops;

    // Only generate the first item?
    this.firstOnly = miscData.firstOnly || false;

    // Element clicked on
    this.context = Object.values(miscData.clickedOn);

    const defaultCenter = {
      x: Config.map.player.x,
      y: Config.map.player.y,
    };

    const hasCustomCenter = tile && tile.center
      && typeof tile.center.x === 'number'
      && typeof tile.center.y === 'number';
    const hasPathCenter = this.player.path && this.player.path.center;
    if (hasCustomCenter) {
      this.viewportCenter = tile.center;
    } else if (hasPathCenter) {
      this.viewportCenter = this.player.path.center;
    } else {
      this.viewportCenter = defaultCenter;
    }

    const hasCustomViewport = tile && tile.viewport
      && typeof tile.viewport.x === 'number'
      && typeof tile.viewport.y === 'number';
    const hasPathViewport = this.player.path && this.player.path.viewport;
    if (hasCustomViewport) {
      this.viewportSize = tile.viewport;
    } else if (hasPathViewport) {
      this.viewportSize = this.player.path.viewport;
    } else {
      this.viewportSize = {
        x: Config.map.viewport.x,
        y: Config.map.viewport.y,
      };
    }

    const hasWorldCoordinates = tile && tile.world
      && typeof tile.world.x === 'number'
      && typeof tile.world.y === 'number';
    const worldCoordinates = hasWorldCoordinates
      ? tile.world
      : {
        x: this.player.x - this.viewportCenter.x + tile.x,
        y: this.player.y - this.viewportCenter.y + tile.y,
      };

    // Coordinates of mouse-click and player
    this.coordinates = {
      // Where player is currently
      player: {
        x: this.player.x,
        y: this.player.y,
      },
      // Where on map they clicked on
      map: {
        x: worldCoordinates.x,
        y: worldCoordinates.y,
      },
      // Where in viewport they clicked on
      viewport: {
        x: tile.x,
        y: tile.y,
      },
    };

    // Are they on any pane?
    this.currentPane = this.player.currentPane;

    // For screens not managed by shops, banks or inventories.
    this.currentPaneData = this.player.currentPaneData;

    // Data relevant to the context
    this.miscData = miscData;
  }

  /**
   * Build the context-menu list items
   *
   * @returns {promise}
   */
  build() {
    const self = this;

    return new Promise((resolve) => {
      let list = 0;
      const generateList = this.generateList();
      const items = [];

      do {
        const action = generateList[list];
        self.check(action, items);
        list += 1;
      } while (list < generateList.length);

      items
        .sort((a, b) => b.timestamp - a.timestamp)
        .sort((a, b) => a.action.weight - b.action.weight);

      if (this.miscData.firstOnly) {
        resolve({
          firstItem: items[0],
          count: items.length - 1,
        });
      }

      resolve(items);
    }, this);
  }

  /**
   * Check to see if the list item is needed in list
   *
   * @param {string} action The item being checked
   * @returns {boolean}
   */
  async check(action, items) {
    if (!action) return;

    const strategy = getStrategy(action.actionId);
    if (!strategy) return;

    const context = this.createStrategyContext(action);

    if (!strategy.canExecute(context)) {
      return;
    }

    const results = strategy.execute(context);

    if (!Array.isArray(results)) {
      return;
    }

    results
      .filter(Boolean)
      .forEach((result) => {
        if (!result.action) {
          result.action = action;
        }
        items.push(result);
      });
  }

  createStrategyContext(action) {
    const viewportPadding = 1;
    const viewportMinX = this.player.x - this.viewportCenter.x - viewportPadding;
    const viewportMinY = this.player.y - this.viewportCenter.y - viewportPadding;
    const viewportMaxX = viewportMinX + this.viewportSize.x + (viewportPadding * 2);
    const viewportMaxY = viewportMinY + this.viewportSize.y + (viewportPadding * 2);

    const groundItems = this.droppedItems
      .filter(
        item => item.x >= viewportMinX && item.x <= viewportMaxX,
      )
      .filter(
        item => item.y >= viewportMinY && item.y <= viewportMaxY,
      )
      .filter(
        item => item.x === this.coordinates.map.x && item.y === this.coordinates.map.y,
      )
      .map((item) => {
        item.context = 'item';
        return item;
      });

    const npcs = this.npcs
      .filter(
        // NPCs amble at float positions; they occupy the tile they round to.
        npc => Math.round(npc.x) === this.coordinates.map.x
          && Math.round(npc.y) === this.coordinates.map.y,
      )
      .map((npc) => {
        npc.context = 'npc';
        return npc;
      });

    // getTileOverMouse now returns zero-based global ids (gid - 1);
    // foreground data definitions are keyed by objects.png local ids.
    const foregroundTile = UI.getTileOverMouse(
      this.foreground,
      this.coordinates.player.x,
      this.coordinates.player.y,
      this.coordinates.viewport.x,
      this.coordinates.viewport.y,
      'foreground',
      { center: this.viewportCenter },
    ) - 252;

    const foregroundData = Query.getForegroundData(foregroundTile);

    const itemSource = {
      inventorySlot: this.player.inventory.slots,
      bankSlot: this.player.bank,
      shopSlot: this.getShopInventory(),
    };

    const activePaneItems = this.currentPane ? this.currentPaneData : null;
    const itemsToSearch =
      itemSource[this.context[3]]
      || activePaneItems
      || this.player.inventory.slots;

    const selectedItem =
      itemsToSearch.find((entry) => entry && entry.slot === this.miscData.slot)
      || itemsToSearch[this.miscData.slot];

    const dynamicItem = typeof selectedItem === 'object' ? selectedItem : null;

    let itemActedOn = selectedItem;
    if (typeof itemActedOn === 'object' && itemActedOn !== null) {
      itemActedOn = itemActedOn.id;
    }

    const selectedItemData =
      itemActedOn !== undefined && itemActedOn !== null
        ? Query.getItemData(itemActedOn)
        : null;

    return {
      menu: this,
      action,
      groundItems,
      npcs,
      foregroundTile,
      foregroundData,
      selectedItem,
      dynamicItem,
      itemActedOn,
      selectedItemData,
      coordinates: this.coordinates,
      miscData: this.miscData,
      tile: this.tileData,
    };
  }

  /**
   * The list of actionable items that can appear
   *
   * @returns {array}
   */
  generateList() {
    const list = actionList;

    return list.filter(a => a.context.some(b => this.context.includes(b)));
  }

  /**
   * See if incoming data has a certain object data
   *
   * @param {string} object The payload of the incoming menu item
   * @param {string} name The name of the objeect property we check for
   * @returns {boolean}
   */
  static hasProp(object, name) {
    return Object.prototype.hasOwnProperty.call(object, name);
  }

  /**
   * See if the action allows to be clicked on from an appropriate class
   *
   * @param {object} target The element we are clicking on
   * @returns {boolean}
   */
  clickedOn(target) {
    return this.context.includes(target);
  }

  /**
   * Check to see if the context-menu invocation came from the player's inventory
   *
   * @returns {boolean}
   */
  isFromInventory() {
    return ContextMenu.hasProp(this.miscData, 'slot');
  }

  /**
   * Checks to see if context-menu invocation came from the game screen
   *
   * @returns {boolean}
   */
  isFromGameCanvas() {
    // TODO
    // Get the top-left X,Y and right-bottom X,Y of .gameMap and then
    // see if mouse-click is within those limits. Technically, you
    // would have clicked on the gameCanvas because of X,Y origin.
    return this.clickedOn('gameMap') || this.clickedOn('bankSlot');
  }

  /**
   * Get the shop inventory based on NPC
   *
   * @returns {array}
   */
  getShopInventory() {
    if (!this.player.objectId) return [];
    const shopIndex = world.shops.findIndex(
      q => q.npcId === this.player.objectId,
    );

    if (shopIndex === -1) return [];
    return world.shops[shopIndex].inventory;
  }

  /**
   * Checks to see if an action can be acted upon with the item or subject
   *
   * @example 'Does a pickaxe include an action of "Mine"?'
   * @param {object} item The item being checked
   * @param {object} action The action being checked
   * @returns {boolean}
   */
  canDoAction(item, action) {
    const name = action.name.toLowerCase();

    // Can we allow this action while a certain pane is open?
    // (ie: Equip not allowed while accessing bank)
    if (action.disallowWhile && action.disallowWhile.includes(this.currentPane)) return false;
    if (action.onPane && !action.onPane.includes(this.currentPane)) return false;

    // If we have a list of actions
    if (item instanceof Array) {
      return item.includes(name);
    }

    // If we have just one resource that has actions
    if (item && item.actions) {
      return item.actions.includes(name);
    }

    return false;
  }
}

export default ContextMenu;
export { actionCatalog } from './context-menu/strategies/registry.js';
