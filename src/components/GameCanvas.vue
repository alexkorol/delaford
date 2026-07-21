<template>
  <div
    class="game"
    :style="canvasStyle"
  >
    <div class="first-action">{{ action }}</div>
    <div
      v-if="current !== false"
      :style="getPaneDimensions"
      :class="['pane', { 'pane--bank': current === 'bank' }]"
    >
      <component
        :is="current"
        :game="game"
        :data="screenData"
      />
      <button
        type="button"
        class="pane-close"
        aria-label="Close current pane"
        @click="closePane"
      >
        ×
      </button>
    </div>
    <canvas
      id="game-map"
      tabindex="0"
      aria-label="Game world"
      class="main-canvas gameMap"
      :height="canvasDimensions.height"
      :width="canvasDimensions.width"
      @mouseenter="onGame = true"
      @mouseleave="onGame = false"
      @mousemove="mouseSelection"
      @click.left="leftClick"
      @contextmenu.prevent="rightClick"
    />
  </div>
</template>

<script>
import { mapStores } from 'pinia';

import UI from '@shared/ui.js';
import { getSkillExecutionProfile } from '@shared/skills/index.js';
import config from '@server/config.js';
import { useUiStore } from '@/stores/ui.js';
import ClientUI from '../core/utilities/client-ui.js';
import bus from '../core/utilities/bus.js';
import Socket from '../core/utilities/socket.js';
import InputController from '../core/utilities/input-controller.js';

export default {
  name: 'Game',
  emits: ['pane-state'],
  props: {
    game: {
      type: Object,
      required: true,
    },
    worldViewport: {
      type: Object,
      default: () => ({ x: 24, y: 15, scale: 1 }),
    },
  },
  data() {
    return {
      mouse: false,
      onGame: false,
      current: false,
      screenData: false,
      tileX: 0,
      tileY: 0,
      event: false,
      inputController: null,
    };
  },
  computed: {
    ...mapStores(useUiStore),
    canvasNativeDimensions() {
      const tile = this.resolveTileDimensions();
      const viewport = this.resolveViewportDimensions();
      const width = (tile.width || 0) * (viewport.x || 0);
      const height = (tile.height || 0) * (viewport.y || 0);

      return {
        width: Number.isFinite(width) && width > 0 ? width : 512,
        height: Number.isFinite(height) && height > 0 ? height : 352,
      };
    },
    canvasDimensions() {
      const { width, height } = this.canvasNativeDimensions;
      const scale = this.resolveDisplayScale();

      return {
        width: width * scale,
        height: height * scale,
      };
    },
    canvasStyle() {
      const { width, height } = this.canvasNativeDimensions;
      const scale = this.resolveDisplayScale();
      const displayWidth = width * scale;
      const displayHeight = height * scale;

      return {
        '--map-native-width': `${width}px`,
        '--map-native-height': `${height}px`,
        '--map-display-width': `${displayWidth}px`,
        '--map-display-height': `${displayHeight}px`,
      };
    },
    getPaneDimensions() {
      switch (this.current) {
      default:
        return '';
      case 'furnace':
        return 'width:70%;height:40%';
      }
    },
    currentAction() {
      return this.uiStore.action.object;
    },
    action() {
      return this.uiStore.action.label;
    },
    otherPlayers() {
      return this.game.players.filter(
        (p) => p.socket_id !== this.game.player.socket_id,
      );
    },
  },
  watch: {
    current(newVal) {
      this.$emit('pane-state', typeof newVal !== 'boolean');
      if (typeof newVal === 'boolean') {
        Socket.emit('player:pane:close', {
          id: this.game.player.uuid,
        });
      }
    },
  },
  created() {
    bus.$on('canvas:getMouse', () => this.mouseSelection());
    bus.$on('open:screen', this.openScreen);
    bus.$on('screen:close', this.closePane);
    bus.$on('game:context-menu:first-only', ClientUI.displayFirstAction);
    bus.$on('canvas:reset-context-menu', () => this.mouseSelection());
  },
  mounted() {
    this.initialiseInputController();
    // Movement/skill input listens on window, not the canvas element: the
    // old canvas-focus binding meant WASD went completely dead after
    // clicking any UI (chat, panes, menu buttons) until the player clicked
    // the game world again.
    window.addEventListener('keydown', this.handleGlobalKeyDown);
    window.addEventListener('keyup', this.handleGlobalKeyUp);
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.handleGlobalKeyDown);
    window.removeEventListener('keyup', this.handleGlobalKeyUp);
    if (this.inputController) {
      this.inputController.destroy();
      this.inputController = null;
    }
  },
  methods: {
    resolveTileDimensions() {
      const fallback = (config && config.map && config.map.tileset && config.map.tileset.tile) || {};
      const runtime = this.game
        && this.game.map
        && this.game.map.config
        && this.game.map.config.map
        && this.game.map.config.map.tileset
        && this.game.map.config.map.tileset.tile;
      const width = (runtime && runtime.width) || fallback.width || 32;
      const height = (runtime && runtime.height) || fallback.height || 32;
      return { width, height };
    },
    resolveViewportDimensions() {
      const fallback = (config && config.map && config.map.viewport) || {};
      const requested = this.worldViewport || {};
      const runtime = this.game
        && this.game.map
        && this.game.map.config
        && this.game.map.config.map
        && this.game.map.config.map.viewport;
      const x = (runtime && runtime.x) || requested.x || fallback.x || 24;
      const y = (runtime && runtime.y) || requested.y || fallback.y || 15;
      return { x, y };
    },
    resolveDisplayScale() {
      if (this.game && this.game.map && typeof this.game.map.scale === 'number') {
        return this.game.map.scale;
      }

      if (this.worldViewport && typeof this.worldViewport.scale === 'number') {
        return this.worldViewport.scale;
      }

      return 1;
    },
    initialiseInputController() {
      if (this.inputController) {
        this.inputController.destroy();
      }

      this.inputController = new InputController({
        onMove: (direction) => this.onMoveIntent(direction),
        onStop: () => this.onMoveStop(),
        onSkill: (payload) => this.onSkillIntent(payload),
      });
    },
    onMoveIntent(direction) {
      if (!direction) {
        return;
      }

      this.dispatchMovement(direction);
    },
    onMoveStop() {
      if (this.game && typeof this.game.stopMoving === 'function') {
        this.game.stopMoving();
      } else if (this.game && typeof this.game.setLocalIdle === 'function') {
        this.game.setLocalIdle();
      }
    },
    onSkillIntent(payload = {}) {
      const { skillId, phase } = payload;
      if (!skillId) {
        return;
      }

      const profile = getSkillExecutionProfile(skillId) || {};
      const options = {
        animationState: profile.animationState,
        duration: profile.duration,
        holdState: profile.holdState,
        modifiers: profile.modifiers || {},
      };

      this.dispatchSkill(skillId, { ...options, phase });
    },
    getViewportSnapshot() {
      const fallbackViewport = {
        x: config.map.viewport.x,
        y: config.map.viewport.y,
      };
      const fallbackCenter = {
        x: config.map.player.x,
        y: config.map.player.y,
      };

      if (!this.game || !this.game.map || !this.game.map.config) {
        return {
          viewport: { ...fallbackViewport },
          center: { ...fallbackCenter },
        };
      }

      const viewport = this.game.map.config.map.viewport || fallbackViewport;
      const center = this.game.map.config.map.player || fallbackCenter;

      return {
        viewport: {
          x: viewport.x,
          y: viewport.y,
        },
        center: {
          x: center.x,
          y: center.y,
        },
      };
    },
    getWorldCoordinates(local) {
      if (!local) {
        return null;
      }

      const snapshot = this.getViewportSnapshot();
      if (this.game && this.game.map && typeof this.game.map.getViewportMetrics === 'function') {
        const metrics = this.game.map.getViewportMetrics();
        if (metrics && metrics.tileCrop) {
          return {
            x: metrics.tileCrop.x + local.x,
            y: metrics.tileCrop.y + local.y,
          };
        }
      }

      if (this.game && this.game.player) {
        return {
          x: Math.round(this.game.player.x) - snapshot.center.x + local.x,
          y: Math.round(this.game.player.y) - snapshot.center.y + local.y,
        };
      }

      return {
        x: snapshot.center.x + local.x,
        y: snapshot.center.y + local.y,
      };
    },
    /**
     * Close the context-menu
     */
    closePane() {
      this.current = false;
    },
    /**
     * Open the context-menu
     *
     * @param {object} incoming The data returned from the context-menu
     */
    openScreen(incoming) {
      this.current = incoming.data.screen;
      this.screenData = incoming.data.payload;
    },
    /**
     * Right-click brings up context-menu
     *
     * @param {event} event The mouse-click event
     */
    rightClick(event) {
      const coordinates = this.resolveViewportCoordinates(event);
      const snapshot = this.getViewportSnapshot();
      const world = this.getWorldCoordinates(coordinates);

      const data = {
        event,
        coordinates,
        target: event.target,
        world,
        viewport: snapshot.viewport,
        center: snapshot.center,
      };

      event.preventDefault();
      bus.$emit('PLAYER:MENU', data);
    },

    /**
     * Player clicks on game-map
     *
     * @param {event} event The mouse-click event
     */
    leftClick(event) {
      bus.$emit('screen:close');

      if (!this.currentAction || !this.currentAction.action) {
        bus.$emit('contextmenu:close');
        if (typeof window.focusOnGame === 'function') {
          window.focusOnGame();
        }
        return;
      }

      bus.$emit('canvas:select-action', {
        event,
        item: this.currentAction,
      });
    },

    /**
     * Player hovering over game-map
     *
     * @param {MouseEvent} event
     */
    mouseSelection(event) {
      if (event) {
        this.event = event;
      }

      if (!this.onGame) return;
      const mouseEvent = this.event || this.mouse;
      if (!mouseEvent || !mouseEvent.target) return;
      // Save latest mouse data
      this.mouse = mouseEvent;

      const coordinates = this.resolveViewportCoordinates(mouseEvent);
      const snapshot = this.getViewportSnapshot();
      const world = this.getWorldCoordinates(coordinates);
      const hoveredSquare = {
        x: coordinates.x,
        y: coordinates.y,
      };

      const data = { x: hoveredSquare.x, y: hoveredSquare.y };
      if (
        this.game.map
        && typeof this.game.map.setMouseCoordinates === 'function'
      ) {
        if (hoveredSquare.x >= 0 && hoveredSquare.y >= 0) {
          bus.$emit('DRAW:MOUSE', data);
        }

        if (
          !event
          || ((this.tileX !== hoveredSquare.x || this.tileY !== hoveredSquare.y)
            && this.event
            && this.event.target)
        ) {
          this.tileX = hoveredSquare.x;
          this.tileY = hoveredSquare.y;

          bus.$emit('PLAYER:MENU', {
            coordinates: hoveredSquare,
            event: this.event,
            target: this.event.target,
            firstOnly: true,
            world,
            viewport: snapshot.viewport,
            center: snapshot.center,
          });
        }
      }
    },

    resolveViewportCoordinates(event) {
      if (!event) {
        return { x: 0, y: 0 };
      }

      const { tile } = config.map.tileset;
      const camera = this.game.map && this.game.map.camera
        ? this.game.map.camera
        : { offsetX: 0, offsetY: 0 };
      const viewport = this.game.map && this.game.map.config
        ? this.game.map.config.map.viewport
        : { x: 0, y: 0 };

      const canvasElement = (this.game && this.game.map && this.game.map.canvas)
        ? this.game.map.canvas
        : event.target;
      const bufferCanvas = (this.game && this.game.map && this.game.map.bufferCanvas)
        ? this.game.map.bufferCanvas
        : null;
      const rect = canvasElement && typeof canvasElement.getBoundingClientRect === 'function'
        ? canvasElement.getBoundingClientRect()
        : { width: tile.width, height: tile.height };
      const internalWidth = bufferCanvas && typeof bufferCanvas.width === 'number'
        ? bufferCanvas.width
        : tile.width * (viewport.x || 1);
      const internalHeight = bufferCanvas && typeof bufferCanvas.height === 'number'
        ? bufferCanvas.height
        : tile.height * (viewport.y || 1);

      const position = UI.getMousePos(event);

      const scaleX = rect && rect.width ? internalWidth / rect.width : 1;
      const scaleY = rect && rect.height ? internalHeight / rect.height : 1;

      const canvasX = position.x * scaleX;
      const canvasY = position.y * scaleY;

      const tileX = Math.floor((canvasX + camera.offsetX) / tile.width);
      const tileY = Math.floor((canvasY + camera.offsetY) / tile.height);

      const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

      return {
        x: clamp(tileX, 0, Math.max(viewport.x - 1, 0)),
        y: clamp(tileY, 0, Math.max(viewport.y - 1, 0)),
      };
    },

    handleKeyDown(event) {
      if (this.inputController && this.inputController.handleKeyDown(event)) {
        event.preventDefault();
      }
    },
    handleKeyUp(event) {
      if (this.inputController && this.inputController.handleKeyUp(event)) {
        event.preventDefault();
      }
    },
    // True while the player is typing somewhere game input must not steal.
    isTypingTarget(event) {
      const target = event && event.target;
      if (!target || typeof target.tagName !== 'string') {
        return false;
      }
      const tag = target.tagName.toUpperCase();
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true;
    },
    handleGlobalKeyDown(event) {
      if (this.isTypingTarget(event)) {
        return;
      }
      // Grab key: pick up the item under (or beside) your feet.
      const key = String(event.key || '').toLowerCase();
      if ((key === 'z' || key === 'g') && !event.repeat) {
        Socket.emit('player:take:underfoot', {});
        event.preventDefault();
        return;
      }
      this.handleKeyDown(event);
    },
    handleGlobalKeyUp(event) {
      if (this.isTypingTarget(event)) {
        return;
      }
      this.handleKeyUp(event);
    },
    dispatchMovement(direction) {
      if (!this.game || !this.game.player || !direction) {
        return;
      }

      if (Array.isArray(this.game.player.optimisticQueue)
        && this.game.player.optimisticQueue.length >= 6) {
        // Six unacknowledged predictions means reconciliation lost the
        // thread (teleport, rejection, desync) — a healthy loop never holds
        // more than a couple. Resync and keep moving rather than silently
        // eating the player's input.
        if (typeof this.game.resetOptimisticMovement === 'function') {
          this.game.resetOptimisticMovement();
        } else {
          return;
        }
      }

      this.game.move(direction);
    },
    dispatchSkill(skillId, options = {}) {
      if (!this.game || !this.game.player || !skillId) {
        return;
      }

      if (options.phase === 'end') {
        return;
      }

      const facing = options.direction
        || (typeof this.game.getFacingDirection === 'function'
          ? this.game.getFacingDirection()
          : (this.game.player.animation && this.game.player.animation.direction) || 'down');

      const payload = {
        id: this.game.player.uuid,
        skillId,
        direction: facing,
        issuedAt: Date.now(),
        modifiers: options.modifiers || {},
        phase: options.phase || 'start',
      };

      Socket.emit('player:skill:trigger', payload);

      if (typeof this.game.setLocalAnimation === 'function' && payload.phase !== 'end') {
        this.game.setLocalAnimation(options.animationState || 'attack', {
          direction: facing,
          skillId,
          duration: options.duration,
        });
      }
    },
  },
};
</script>

<style lang="scss" scoped>
/** Main canvas **/
div.game {
  position: relative;
  display: block;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  max-width: none;
  max-height: none;
  background: transparent;
  overflow: hidden;

  canvas.main-canvas {
    width: 100%;
    height: 100%;
    background: #fff;
    outline: none;
    cursor: pointer;
    image-rendering: pixelated;
    display: block;
  }

  .first-action {
    position: absolute;
    z-index: 9;
    left: 0.5em;
    top: 0.5em;
    font-size: 0.75em;
    text-align: left;
    font-family: "GameFont", sans-serif;
    text-shadow: 1px 1px 0 #000;
    color: #fff;
  }

  .pane {
    z-index: 5;
    width: 90%;
    height: 90%;
    margin: 0;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);

    div {
      height: 100%;
      width: 100%;
    }
  }

  .pane--bank {
    left: 25%;
    width: calc(50% - 16px);
  }

  .pane-close {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 2;
    box-sizing: border-box;
    width: 30px;
    height: 30px;
    padding: 3px;
    color: var(--color-text-secondary);
    font: 1rem "GameFont", sans-serif;
    background: var(--control-surface);
    border: 1px solid var(--color-frame-dark);
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid #fff2c8;
      outline-offset: -3px;
    }

    &:hover {
      color: #f0b4a8;
      border-color: var(--color-danger);
      background: linear-gradient(180deg, #4c2424, #211111);
    }
  }

  #context-menu {
    position: absolute;
  }
}
</style>
