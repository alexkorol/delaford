import UI from '#shared/ui.js';
import World from '#server/core/world.js';
import config from '#server/config.js';
import merge from 'lodash/merge.js';
import socketEvents from './handlers/socket-events/index.js';
import playerEvent from './handlers/actions/index.js';

class Action {
  constructor(player, miscData) {
    // Player
    this.player = World.players.find(p => p.socket_id === player);

    this.scene = this.player ? World.getSceneForPlayer(this.player) : World.getDefaultTown();

    // Map layers
    const mapLayers = this.scene && this.scene.map ? this.scene.map : World.map;
    this.background = mapLayers.background;
    this.foreground = mapLayers.foreground;

    // Moving map objects (npcs, items, etc.)
    this.npcs = this.scene && Array.isArray(this.scene.npcs) ? this.scene.npcs : World.npcs;
    this.droppedItems = this.scene && Array.isArray(this.scene.items) ? this.scene.items : World.items;

    // Misc data (slots, etc)
    this.miscData = miscData;

    // On what tile?
    this.tile = false;
  }

  getViewportCenter() {
    if (this.player.path && this.player.path.center) {
      return this.player.path.center;
    }

    return {
      x: config.map.player.x,
      y: config.map.player.y,
    };
  }

  /**
   * Get the walkable tile status of all 4 corners of an action's tile
   *
   * @param {object} action The action being pursued
   * @param {integer} xy The x,y coordinates of action taking place
   * @returns {object}
   */
  getEdgeTiles(action, { x, y }) {
    if (action.nearby === 'edge') {
      const center = this.getViewportCenter();
      const options = { center };
      const tiles = {
        up: UI.getTileOverMouse(
          this.background,
          this.player.x,
          this.player.y,
          x,
          y - 1,
          'background',
          options,
        ),
        right: UI.getTileOverMouse(
          this.background,
          this.player.x,
          this.player.y,
          x + 1,
          y,
          'background',
          options,
        ),
        down: UI.getTileOverMouse(
          this.background,
          this.player.x,
          this.player.y,
          x,
          y + 1,
          'background',
          options,
        ),
        left: UI.getTileOverMouse(
          this.background,
          this.player.x,
          this.player.y,
          x - 1,
          y,
          'background',
          options,
        ),
      };

      const edgeStates = Object.fromEntries(
        Object.entries(tiles).map(([key, value]) => [key, UI.tileWalkable(value)]),
      );
      return edgeStates;
    }

    return false;
  }

  /**
   * Get the tile number the player clicked on
   *
   * @param {object} clickedOn The x,y the player clicked on
   */
  getTileNumber(clickedOn) {
    const { size } = config.map;
    const center = this.getViewportCenter();
    const tileCrop = {
      x: this.player.x - center.x,
      y: this.player.y - center.y,
    };

    if (clickedOn.world && typeof clickedOn.world.x === 'number' && typeof clickedOn.world.y === 'number') {
      this.tile = (clickedOn.world.y * size.x) + clickedOn.world.x;
      return;
    }

    const yIndex = (clickedOn.y + tileCrop.y) * size.x;
    const xIndex = clickedOn.x + tileCrop.x;
    this.tile = yIndex + xIndex;
  }

  /**
   * Execute the certain action by checking (if allowed)
   *
   * @param {object} data Information of tile, Action class and items
   * @param {object} queuedAction The action to take when a player reaches that tile
   */
  do(data, queuedAction = null) {
    const clickedTile = data.tile;
    const incomingAction = data.item.action;
    const doing = incomingAction.name.toLowerCase();

    this.getTileNumber(clickedTile);
    const center = this.getViewportCenter();
    const worldCoordinates = (clickedTile.world
      && typeof clickedTile.world.x === 'number'
      && typeof clickedTile.world.y === 'number')
      ? clickedTile.world
      : {
        x: this.player.x - center.x + clickedTile.x,
        y: this.player.y - center.y + clickedTile.y,
      };
    const viewportState = (clickedTile.viewport
      && typeof clickedTile.viewport.x === 'number'
      && typeof clickedTile.viewport.y === 'number')
      ? clickedTile.viewport
      : null;
    const centerState = (clickedTile.center
      && typeof clickedTile.center.x === 'number'
      && typeof clickedTile.center.y === 'number')
      ? clickedTile.center
      : center;

    const tileWalkable = UI.tileWalkable(UI.getTileOverMouse(
      this.background,
      this.player.x,
      this.player.y,
      clickedTile.x,
      clickedTile.y,
      'background',
      { center },
    )); // TODO: Add foreground.

    // If the player clicked on himself make the action be immediate
    if (clickedTile.x === center.x && clickedTile.y === center.y) {
      incomingAction.queueable = false;
      if (queuedAction) {
        queuedAction.queueable = false;
      }
    }

    // If an action needs to be performed
    // after a player reaches their destination
    if (queuedAction && queuedAction.queueable) {
      // Queue it up and tell the server.
      // IF already in queue... do not add it
      socketEvents['player:queueAction'](merge(queuedAction, {
        player: {
          socket_id: this.player.socket_id,
        },
        actionToQueue: {
          ...data.item.action,
          onTile: this.tile,
          coordinates: { x: clickedTile.x, y: clickedTile.y },
          world: worldCoordinates,
          viewport: viewportState,
          center: centerState,
        },
      }), { id: this.player.socket_id });
    }

    // Object need to complete an action
    const dataObject = {
      clickedTile: data.tile,
      doing,
      tileWalkable,
      item: data.item || false,
      player: this.player,
      id: this.player.uuid,
      data: {
        miscData: this.miscData,
      },
      location: incomingAction.nearby,
      coordinates: { x: clickedTile.x, y: clickedTile.y },
      world: worldCoordinates,
      viewport: viewportState,
      center: centerState,
    };

    // TODO
    // Refactor this as not every queueable
    // action will need 'player:mouseTo' before it
    const iminimentAction = incomingAction.queueable ? 'player:mouseTo' : incomingAction.actionId;

    // No action? Do nothing. (eg: Cancel)
    if (!iminimentAction) return;

    playerEvent[iminimentAction](dataObject);
  }
}

export default Action;
