<template>
  <div
    id="context-menu"
    :style="style"
    @contextmenu.prevent="contextClick"
  >
    <ul
      v-if="view"
      id="actions"
      tabindex="-1"
      @blur="closeMenu"
    >
      <!-- Labels are server-authored and carry colour markup for item
           rarity; text interpolation showed the raw tags to the player. -->
      <li
        v-for="(item, index) in items"
        :key="index"
        class="action"
        @click="selectAction($event, item)"
        v-html="item.label"
      />
      <li
        class="action"
        @click="selectAction($event, { action: { name: 'cancel' } })"
      >
        Cancel
      </li>
    </ul>
  </div>
</template>

<script>
import { omit } from 'lodash';
import bus from '../../core/utilities/bus.js';
import Socket from '../../core/utilities/socket.js';

export default {
  props: {
    game: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      items: [],
      mouseEvent: null,
      actions: {},
      view: false,
      tile: {
        x: null,
        y: null,
      },
      world: {
        x: null,
        y: null,
      },
      viewport: {
        x: null,
        y: null,
      },
      center: {
        x: null,
        y: null,
      },
      style: {
        top: '0px',
        left: '0px',
      },
    };
  },
  created() {
    bus.$on('PLAYER:MENU', this.buildMenu);
    bus.$on('game:context-menu:items', this.createMenu);
    bus.$on('contextmenu:close', this.closeMenu);
    bus.$on('canvas:select-action', (event) => {
      this.selectAction(event.event, event.item);
    });
  },
  methods: {
    getTilePayload() {
      const payload = {
        x: this.tile.x,
        y: this.tile.y,
      };

      if (this.world.x !== null && this.world.y !== null) {
        payload.world = { ...this.world };
      }

      if (this.viewport.x !== null && this.viewport.y !== null) {
        payload.viewport = { ...this.viewport };
      }

      if (this.center.x !== null && this.center.y !== null) {
        payload.center = { ...this.center };
      }

      return payload;
    },
    /**
     * Tell the game to do the selected action
     *
     * @param {event} event The mouse-click event
     * @param {string} item The menu item selected
     */
    async selectAction(event, item) {
      // Data to perform action
      if (!item || !item.action) {
        this.closeMenu();
        return;
      }

      const tilePayload = this.getTilePayload();
      const data = {
        item,
        tile: tilePayload,
      };

      // Data for queued action
      const queueItem = {
        item: {
          uuid: item.uuid,
          id: item.id,
        },
        tile: tilePayload,
        action: item.action,
        at: item.at || false,
        coordinates: item.coordinates || false,
        queueable: item.action.queueable,
      };

      if (tilePayload.world) {
        queueItem.world = { ...tilePayload.world };
      }

      // Tell server to do action
      Socket.emit('player:context-menu:action', {
        data,
        queueItem,
        player: {
          socket_id: this.game.player.socket_id,
        },
      });

      // Close menu and focus back on game
      this.closeMenu();
      window.focusOnGame();
    },

    /**
     * Sets the context-menu where mouse was clicked upon
     *
     * @param {integer} x The x-axis of where the mouse was clicked
     * @param {integer} y The y-axis of where the mouse was clicked
     */
    setMenu(x, y) {
      const menu = this.$el && this.$el.querySelector ? this.$el.querySelector('#actions') : null;
      const menuWidth = menu && menu.offsetWidth ? menu.offsetWidth : 195;
      const menuHeight = menu && menu.offsetHeight ? menu.offsetHeight : 120;
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : x + menuWidth;
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : y + menuHeight;
      const left = Math.min(Math.max(0, x - 9), Math.max(0, viewportWidth - menuWidth - 8));
      const top = Math.min(Math.max(0, y - 7), Math.max(0, viewportHeight - menuHeight - 8));

      this.style.left = `${left}px`;
      this.style.top = `${top}px`;
    },

    /**
     * Closes the context-menu
     */
    closeMenu() {
      this.view = false;
    },

    /**
     * Tell server to start building the menu
     * @param {object} data The coordinates of the player and MouseEvent
     */
    buildMenu(data) {
      if (!data || !data.coordinates || !data.event || !data.event.target) {
        return;
      }

      // Tile coordinates and mouse event
      this.mouseEvent = data.event;
      this.tile.x = data.coordinates.x;
      this.tile.y = data.coordinates.y;

      if (data.world) {
        this.world = {
          x: data.world.x,
          y: data.world.y,
        };
      } else {
        this.world = { x: null, y: null };
      }

      if (data.viewport) {
        this.viewport = {
          x: data.viewport.x,
          y: data.viewport.y,
        };
      } else {
        this.viewport = { x: null, y: null };
      }

      if (data.center) {
        this.center = {
          x: data.center.x,
          y: data.center.y,
        };
      } else {
        this.center = { x: null, y: null };
      }

      // Remove misc info
      const miscData = omit(
        { ...data, clickedOn: data.event.target.classList || [] },
        ['coordinates', 'event', 'target', 'world', 'viewport', 'center'],
      );

      // Tell server to start building context menu
      Socket.emit('player:context-menu:build', {
        miscData,
        tile: this.getTilePayload(),
        viewport: this.viewport,
        center: this.center,
        player: {
          socket_id: this.game.player.socket_id,
        },
      });
    },

    /**
     * Generates the list of selectable items on context-menu
     *
     * @param {object} data The list of items for the context menu
     */
    createMenu(data) {
      // List has been generated from server
      this.items = data.data.data
        .sort((a, b) => b.timestamp - a.timestamp) // Sort by when item appeared
        .sort((a, b) => a.action.weight - b.action.weight); // then by action weight

      if (this.items.length === 0) {
        this.closeMenu();
        return;
      }

      // Ready to show
      this.view = true;

      // On next vue tick, show map
      this.$nextTick(() => {
        // Set context menu on map
        this.setMenu(this.mouseEvent.x, this.mouseEvent.y);
      });
    },

    /**
     * Incase we click on the context menu with anything but a left-click
     *
     * @param {event} event The non-left mouse-click on the context-menu
     */
    contextClick(event) {
      event.preventDefault();
    },
  },
};
</script>

<style lang="scss" scoped>
$menu_bg_color: #8d8d8d;
$menu_font_color: #fff;
$menu_min_width: 100px;
$menu_max_width: 195px;
$menu_font_hover_color: #ffd829;

div {
  position: absolute;
  z-index: 500;

  ul#actions {
    font-family: "GameFont", sans-serif;
    box-shadow: 2.5px 2.5px 0 0 rgba(0, 0, 0, 0.75);
    outline: none;
    background: $menu_bg_color;
    display: block;
    list-style: none;
    margin: 0;
    padding: 0 0 3px 0;
    max-width: $menu_max_width;
    min-width: $menu_min_width;
    font-size: 12px;
    z-index: 501;

    li.action {
      cursor: pointer;
      color: $menu_font_color;
      text-align: left;
      padding: 2px 5px;
      text-shadow: 1px 1px 0 #000;
      margin: 0;

      &:hover {
        color: $menu_font_hover_color;
      }
    }
  }
}
</style>
