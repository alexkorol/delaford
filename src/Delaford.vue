<template>
  <div id="app">
    <div
      v-if="connectionLost"
      class="connection-banner"
    >
      Connection lost — reconnecting…
    </div>

    <div
      v-if="sessionNotice"
      class="connection-banner"
    >
      {{ sessionNotice }}
    </div>

    <div
      v-if="clientErrorNotice"
      class="connection-banner connection-banner--error"
    >
      {{ clientErrorNotice }}
    </div>

    <AuthContainer
      v-if="showAuthScreen"
      :screen="screen"
      :chronicles-context="chroniclesContext"
      @navigate="handleAuthNavigate"
      @set-out="handleChroniclesSetOut"
    />

    <GameContainer
      v-if="showGameScreen"
      ref="gameContainer"
      :game="game"
      :layout-mode="layoutMode"
      :pane-registry="paneRegistryMap"
      :default-left-pane="defaultLeftPane"
      :default-right-pane="defaultRightPane"
      :active-overlay-descriptor="activeOverlayDescriptor"
      :world-shell-style="worldShellStyle"
      :world-viewport="worldViewport"
      :player-vitals="playerVitals"
      :player-progress="playerProgress"
      :quick-slots="quickSlots"
      :quickbar-active-index="quickbarActiveIndex"
      :quickbar-cooldowns="quickbarCooldowns"
      :party="party"
      :party-invites="partyInvites"
      :party-loading="partyLoading"
      :party-status-message="partyStatusMessage"
      :is-desktop="isDesktop"
      :chat-shell-classes="chatShellClasses"
      :chat-toggle-label="chatToggleLabel"
      :chat-preview="layout.chat.preview"
      :chat-unread-count="chatUnreadCount"
      :chat-pinned="layout.chat.isPinned"
      :chat-expanded="chatExpanded"
      :chat-auto-hide-seconds="chatAutoHideSeconds"
      @right-click="nothing"
      @overlay-close="closePane"
      @quick-slot="handleQuickSlot"
      @request-remap="handleQuickbarRemap"
      @party-create="handlePartyCreate"
      @party-leave="handlePartyLeave"
      @party-toggle-ready="handlePartyReadyToggle"
      @party-start-instance="handlePartyStartInstance"
      @party-return-to-town="handlePartyReturnToTown"
      @party-invite="handlePartyInviteRequest"
      @party-accept-invite="handlePartyAcceptInvite"
      @party-decline-invite="handlePartyDeclineInvite"
      @enter-zone="handleEnterZone"
      @toggle-chat="toggleChat"
      @toggle-chat-pin="toggleChatPin"
      @chat-hover="handleChatHover"
      @chat-countdown-complete="closeChat"
      @chat-message="handleChatMessage"
    />
  </div>
</template>

<script>
// Vue components
import config from '@server/config.js';
import AuthContainer from './components/layout/AuthContainer.vue';
import GameContainer from './components/layout/GameContainer.vue';
import StatsPane from './components/slots/Stats.vue';
import InventoryPane from './components/slots/Inventory.vue';
import WearPane from './components/slots/Wear.vue';
import FriendListPane from './components/slots/FriendList.vue';
import SettingsPane from './components/slots/Settings.vue';
import LogoutPane from './components/slots/Logout.vue';
import QuestsPane from './components/slots/Quests.vue';
import GeometricSkillTreePane from './components/passives/GeometricSkillTreePane.vue';

import UI from '@shared/ui.js';
import { createQuickbarSlots, getSkillExecutionProfile } from '@shared/skills/index.js';

// Core assets
import Client from './core/client.js';
import Engine from './core/engine.js';
import { buildCombatLogEntry } from './core/combat-log.js';
import bus from './core/utilities/bus.js';
import Event from './core/player/events.js';
import MovementController from './core/utilities/movement-controller.js';
import { now } from './core/config/movement.js';
import Socket from './core/utilities/socket.js';
import { shouldRootHandleQuickbarHotkey } from './core/hotkeys.js';
import { resetPartyClientState } from './core/party-state.js';
import {
  entombScion,
  getActiveHouse,
  getActiveScion,
  loadHouses,
  saveHouses,
} from './core/chronicles/houses.js';

const createDefaultQuickSlots = () => createQuickbarSlots();

const paneRegistry = {
  stats: { component: StatsPane, title: 'Character', slot: 'left' },
  inventory: { component: InventoryPane, title: 'Inventory', slot: 'right' },
  wear: { component: WearPane, title: 'Equipment' },
  friendlist: { component: FriendListPane, title: 'Friends' },
  settings: { component: SettingsPane, title: 'Settings' },
  logout: { component: LogoutPane, title: 'Logout' },
  quests: { component: QuestsPane, title: 'Quests' },
  flowerOfLife: { component: GeometricSkillTreePane, title: 'Skill Tree', options: { fullscreen: true } },
};

const defaultPaneAssignments = {
  left: null,
  right: null,
};

const DEFAULT_CHAT_PREVIEW = 'Welcome to Verdigris.';
const DEFAULT_CHAT_AUTOHIDE_SECONDS = 8;
const DESKTOP_PANE_GUTTER = 8;
const MOBILE_PANE_GUTTER = 6;

const floorOdd = (value, minimum = 1) => {
  const numeric = Number.isFinite(value) ? value : minimum;
  let floored = Math.floor(numeric);

  if (floored < minimum) {
    floored = minimum;
  }

  if (floored % 2 === 0 && floored > minimum) {
    floored -= 1;
  }

  return floored;
};

const getInitialMapDimensions = (mapConfig = {}) => {
  const tileWidth = mapConfig?.tileset?.tile?.width || 0;
  const tileHeight = mapConfig?.tileset?.tile?.height || 0;
  const viewportX = mapConfig?.viewport?.x || 0;
  const viewportY = mapConfig?.viewport?.y || 0;

  const computedWidth = tileWidth * viewportX;
  const computedHeight = tileHeight * viewportY;

  const fallbackWidth = computedWidth > 0 ? computedWidth : 512;
  const fallbackHeight = computedHeight > 0 ? computedHeight : 352;

  return {
    width: fallbackWidth,
    height: fallbackHeight,
    displayWidth: fallbackWidth,
    displayHeight: fallbackHeight,
    scale: 1,
  };
};

export default {
  name: 'Delaford',
  components: {
    AuthContainer,
    GameContainer,
  },
  data() {
    return {
      config,
      loaded: false,
      game: { exit: true },
      screen: 'login',
      chroniclesContext: null,
      permadeathHandled: false,
      connectionLost: false,
      reconnectAttempts: 0,
      intentionalDisconnect: false,
      sessionNotice: '',
      clientErrorNotice: '',
      skipAutoRelogin: false,
      layout: {
        activePane: null,
        leftPane: defaultPaneAssignments.left,
        rightPane: defaultPaneAssignments.right,
        chat: {
          isPinned: false,
          isOpen: false,
          unreadCount: 0,
          preview: DEFAULT_CHAT_PREVIEW,
        },
      },
      quickSlots: createDefaultQuickSlots(),
      viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 1440,
      viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 900,
      viewportResizeRaf: null,
      bodyOverflowBackup: '',
      quickbarActiveIndex: null,
      quickbarFlashTimeout: null,
      party: null,
      partyInvites: [],
      partyLoading: { active: false, state: null },
      partyStatusMessage: '',
      partyStatusTimeout: null,
      mapDimensions: getInitialMapDimensions(config.map),
    };
  },
  computed: {
    layoutMode() {
      if (this.viewportWidth < 768) {
        return 'mobile';
      }
      if (this.viewportWidth < 1200) {
        return 'tablet';
      }
      return 'desktop';
    },
    isDesktop() {
      return this.layoutMode === 'desktop';
    },
    showAuthScreen() {
      return !this.loaded || Boolean(this.game && this.game.exit);
    },
    showGameScreen() {
      return this.loaded && Boolean(this.game && this.game.map);
    },
    quickbarCooldowns() {
      // Server-authoritative cooldown map: skillId -> ready-at timestamp
      // (ms). The quickbar renders each slot's remaining sweep from this.
      const combat = this.game && this.game.player && this.game.player.combat;
      return (combat && combat.cooldowns) ? combat.cooldowns : {};
    },
    playerVitals() {
      const fallback = {
        hp: { current: 0, max: 0 },
        mp: { current: 0, max: 0 },
      };
      const player = this.game && this.game.player;
      if (!player) {
        return fallback;
      }

      const firstDefined = (candidates, defaultValue) => {
        for (let index = 0; index < candidates.length; index += 1) {
          const value = candidates[index];
          if (value !== undefined && value !== null) {
            return value;
          }
        }
        return defaultValue;
      };

      const normaliseMeter = (meter, fallbackMax) => {
        if (!meter || typeof meter !== 'object') {
          return { current: 0, max: fallbackMax || 0 };
        }

        const currentSource = firstDefined([meter.current, meter.value, meter.amount], 0);
        const maxSource = firstDefined([meter.max, meter.maximum, meter.capacity, fallbackMax], fallbackMax || 0);

        const current = Number(currentSource);
        const max = Number(maxSource);

        return {
          current: Number.isFinite(current) ? current : 0,
          max: Number.isFinite(max) ? max : 0,
        };
      };

      const stats = player.stats || {};
      const resources = stats.resources || {};
      const hpSource = player.hp || player.health || resources.health || stats.hp;
      const mpSource = player.mp || player.mana || resources.mana || stats.mp;

      const hpMax = resources.health && Number.isFinite(resources.health.max)
        ? resources.health.max
        : stats.hp && stats.hp.max
          ? stats.hp.max
          : 0;

      const mpMax = resources.mana && Number.isFinite(resources.mana.max)
        ? resources.mana.max
        : stats.mp && stats.mp.max
          ? stats.mp.max
          : 0;

      return {
        hp: normaliseMeter(hpSource, hpMax),
        mp: normaliseMeter(mpSource, mpMax),
      };
    },
    playerProgress() {
      const fallback = { level: 1, fraction: 0 };
      const player = this.game && this.game.player;
      if (!player) {
        return fallback;
      }

      const skills = player.skills || {};
      const combatXp = ['attack', 'defence'].reduce((total, skillId) => {
        const skill = skills[skillId];
        return total + (skill && Number.isFinite(skill.exp) ? skill.exp : 0);
      }, 0);

      const derived = UI.getLevel(combatXp);
      const statsLevel = player.stats && Number.isFinite(player.stats.level)
        ? player.stats.level
        : (player.level || 1);
      const level = Math.max(derived, statsLevel, 1);

      const currentFloor = UI.getExperience(level);
      const nextRequirement = UI.getExperience(level + 1);
      const span = nextRequirement - currentFloor;
      const fraction = span > 0
        ? Math.max(0, Math.min(1, (combatXp - currentFloor) / span))
        : 0;

      return { level, fraction };
    },
    chatExpanded() {
      return this.layout.chat.isOpen || this.layout.chat.isPinned;
    },
    chatUnreadCount() {
      return this.layout.chat.unreadCount;
    },
    chatToggleLabel() {
      return this.chatExpanded ? 'Hide chat' : 'Show chat';
    },
    chatAutoHideSeconds() {
      return this.isDesktop ? 0 : DEFAULT_CHAT_AUTOHIDE_SECONDS;
    },
    paneRegistryMap() {
      return paneRegistry;
    },
    defaultLeftPane() {
      return this.layout.leftPane;
    },
    defaultRightPane() {
      return this.layout.rightPane;
    },
    activeOverlayDescriptor() {
      const id = this.layout.activePane;
      if (!id || !paneRegistry[id]) {
        return { id: null, title: '' };
      }
      const entry = paneRegistry[id];
      return {
        id,
        title: entry.title || '',
      };
    },
    isOverlayBlocking() {
      const { id } = this.activeOverlayDescriptor;
      return Boolean(id);
    },
    chatShellClasses() {
      return {
        'chat-shell--desktop': this.isDesktop,
        'chat-shell--expanded': this.chatExpanded,
        'chat-shell--pinned': this.layout.chat.isPinned,
      };
    },
    worldViewport() {
      const mapInstance = this.game && this.game.map ? this.game.map : null;
      const runtimeConfig = mapInstance && mapInstance.config
        ? mapInstance.config.map
        : this.config.map;
      const fallbackDimensions = getInitialMapDimensions(runtimeConfig);
      const resolvedDimensions = {
        ...fallbackDimensions,
        ...this.mapDimensions,
      };
      const width = resolvedDimensions.width || fallbackDimensions.width || 1;
      const height = resolvedDimensions.height || fallbackDimensions.height || 1;
      const scale = typeof resolvedDimensions.scale === 'number'
        ? resolvedDimensions.scale
        : (mapInstance && typeof mapInstance.scale === 'number' ? mapInstance.scale : 1);
      const tileConfig = runtimeConfig?.tileset?.tile || {};
      const tileWidth = tileConfig.width || 32;
      const tileHeight = tileConfig.height || 32;
      const displayTileWidth = tileWidth * scale;
      const displayTileHeight = tileHeight * scale;
      const viewportWidth = this.viewportWidth || (typeof window !== 'undefined' ? window.innerWidth : width * scale);
      const viewportHeight = this.viewportHeight || (typeof window !== 'undefined' ? window.innerHeight : height * scale);
      const gutter = this.layoutMode === 'mobile' ? MOBILE_PANE_GUTTER : DESKTOP_PANE_GUTTER;
      const paneWidth = this.resolvePaneWidth(viewportWidth);
      const centerLeft = this.defaultLeftPane && this.layoutMode !== 'mobile'
        ? paneWidth + (gutter * 2)
        : gutter;
      const centerRight = this.defaultRightPane && this.layoutMode !== 'mobile'
        ? paneWidth + (gutter * 2)
        : gutter;
      const centerTop = this.layoutMode === 'mobile' ? MOBILE_PANE_GUTTER : DESKTOP_PANE_GUTTER;
      const centerBottom = centerTop;
      const centerWidth = Math.max(displayTileWidth * 5, viewportWidth - centerLeft - centerRight - 8);
      const centerHeight = Math.max(displayTileHeight * 5, viewportHeight - centerTop - centerBottom);
      const hudReserve = this.layoutMode === 'mobile' ? 164 : 96;
      const shellReserve = this.layoutMode === 'mobile' ? 12 : 6;
      const maxStageWidth = Math.max(displayTileWidth * 5, centerWidth - shellReserve);
      const maxStageHeight = Math.max(displayTileHeight * 5, centerHeight - hudReserve - shellReserve);

      const maxColumns = floorOdd(maxStageWidth / displayTileWidth, 5);
      const maxRows = floorOdd(maxStageHeight / displayTileHeight, 5);
      const aspectColumns = floorOdd((maxRows * 2) + 1, 5);
      let columns = Math.min(maxColumns, aspectColumns);
      let rows = maxRows;

      if (columns < rows) {
        rows = columns;
      }

      const nativeWidth = tileWidth * columns;
      const nativeHeight = tileHeight * rows;
      const displayWidth = nativeWidth * scale;
      const displayHeight = nativeHeight * scale;

      return {
        x: columns,
        y: rows,
        center: {
          x: Math.floor(columns / 2),
          y: Math.floor(rows / 2),
        },
        width: nativeWidth,
        height: nativeHeight,
        displayWidth,
        displayHeight,
        scale,
      };
    },
    worldViewportKey() {
      const viewport = this.worldViewport;
      return `${viewport.x}x${viewport.y}:${viewport.scale}`;
    },
    worldShellStyle() {
      const viewport = this.worldViewport;
      const chromeReserve = this.layoutMode === 'mobile' ? 176 : 106;
      const targetHeight = viewport.displayHeight + chromeReserve;

      return {
        '--map-aspect-ratio': `${viewport.width} / ${viewport.height}`,
        '--world-internal-width': `${viewport.width}px`,
        '--world-internal-height': `${viewport.height}px`,
        '--world-display-width': `${viewport.displayWidth}px`,
        '--world-display-height': `${targetHeight}px`,
        '--map-display-width': `${viewport.displayWidth}px`,
        '--map-display-height': `${viewport.displayHeight}px`,
        '--world-display-scale': `${viewport.scale}`,
      };
    },
  },
  watch: {
    isOverlayBlocking(isOverlay) {
      if (typeof document === 'undefined') {
        return;
      }

      if (isOverlay) {
        if (!this.bodyOverflowBackup) {
          this.bodyOverflowBackup = document.body.style.overflow;
        }
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = this.bodyOverflowBackup || '';
        this.bodyOverflowBackup = '';
      }
    },
    layoutMode(newMode, oldMode) {
      if (newMode === oldMode) {
        return;
      }
      if (newMode === 'desktop') {
        if (!this.layout.chat.isPinned) {
          this.cancelChatAutohide();
        }
      } else if (!this.layout.chat.isPinned) {
        this.layout.chat.isOpen = false;
        this.cancelChatAutohide();
      }
    },
    worldViewportKey() {
      this.applyWorldViewportToMap();
    },
  },
  /**
   * WebSocket event handler
   */
  created() {
    const context = this;

    const handleMessage = (evt) => {
      const data = JSON.parse(evt.data);
      const eventName = data.event;

      const canRefresh = ['world', 'player', 'item'].some((e) => eventName.split(':').includes(e));
      // Did the game canvas change that we need
      // to refresh the first context action?
      if (data && eventName && canRefresh) {
        bus.$emit('canvas:reset-context-menu');
      }

      if (eventName !== undefined) {
        if (!Event[eventName]) {
          bus.$emit(eventName, data);
        } else {
          Event[eventName](data, context);
        }
      } else {
        console.log(data);
      }
    };

    // The old behaviour force-reloaded the page 1s after any socket close —
    // every dev-server restart logged the player out. Reconnect with backoff
    // instead, and log straight back in with the remembered credentials.
    const wsUrl = window.ws ? window.ws.url : null;

    const attemptReconnect = () => {
      const delay = Math.min(8000, 750 * (2 ** Math.min(this.reconnectAttempts, 4)));
      this.reconnectAttempts += 1;
      setTimeout(() => {
        if (this.intentionalDisconnect) {
          return;
        }
        const ws = new WebSocket(wsUrl);
        window.ws = ws;
         
        wireSocket(ws);
        ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.connectionLost = false;
          Socket.ensureListeners();
          Socket.flushQueue();
          if (Socket.lastLoginPayload && this.screen === 'game' && !this.skipAutoRelogin) {
            Socket.emit('player:login', Socket.lastLoginPayload);
          }
          this.skipAutoRelogin = false;
        };
      }, delay);
    };

    const wireSocket = (ws) => {
      ws.onmessage = handleMessage;
      ws.onclose = () => {
        if (this.intentionalDisconnect) {
          return;
        }
        this.connectionLost = true;
        attemptReconnect();
      };
      ws.onerror = () => {
        // Before the first successful login a dead server means the classic
        // screen; mid-game errors flow through onclose → reconnect.
        if (this.screen !== 'game') {
          this.screen = 'server-down';
        }
      };
    };

    wireSocket(window.ws);

    this.handleFlowerPaneOpen = () => {
      this.openPane('flowerOfLife');
    };

    // Client-side crash visibility: render errors and uncaught exceptions
    // surface as a banner instead of a silent freeze that looks like a
    // server crash.
    this.handleClientError = (text) => {
      this.clientErrorNotice = String(text || 'Client error');
      clearTimeout(this.clientErrorTimeout);
      this.clientErrorTimeout = setTimeout(() => { this.clientErrorNotice = ''; }, 10000);
    };
    bus.$on('client:error', this.handleClientError);
    window.addEventListener('error', (event) => {
      console.error('[client] uncaught error:', event.error || event.message);
      this.handleClientError(`Client error: ${event.message}`);
    });
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[client] unhandled rejection:', event.reason);
    });

    bus.$on('show-sidebar', this.showSidebar);
    bus.$on('skill-tree:open', this.handleFlowerPaneOpen);
    bus.$on('game:map:dimensions', this.handleMapDimensions);

    // On logout, let's do a few things...
    bus.$on('player:logout', this.logout);
    bus.$on('go:main', this.cancelLogin);
  },
  mounted() {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onViewportResize, { passive: true });
      window.addEventListener('keydown', this.handleGlobalKeydown, { capture: true });
    }

  },
  beforeUnmount() {
    if (this.engine) {
      this.engine.stop();
      this.engine = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onViewportResize);
      window.removeEventListener('keydown', this.handleGlobalKeydown, { capture: true });
      if (this.viewportResizeRaf) {
        window.cancelAnimationFrame(this.viewportResizeRaf);
        this.viewportResizeRaf = null;
      }
    }

    if (typeof document !== 'undefined') {
      document.body.style.overflow = this.bodyOverflowBackup || '';
      this.bodyOverflowBackup = '';
    }

    if (typeof window !== 'undefined') {
      if (this.quickbarFlashTimeout) {
        window.clearTimeout(this.quickbarFlashTimeout);
        this.quickbarFlashTimeout = null;
      }
    }

    if (this.partyStatusTimeout) {
      clearTimeout(this.partyStatusTimeout);
      this.partyStatusTimeout = null;
    }

    bus.$off('skill-tree:open', this.handleFlowerPaneOpen);
    bus.$off('game:map:dimensions', this.handleMapDimensions);
    bus.$off('show-sidebar', this.showSidebar);
    bus.$off('player:logout', this.logout);
    bus.$off('go:main', this.cancelLogin);

    if (this.game && this.game.map && typeof this.game.map.destroy === 'function') {
      this.game.map.destroy();
    }
  },
  methods: {
    handleAuthNavigate(target) {
      this.screen = target;
    },
    openChronicles(context = {}) {
      if (this.engine) {
        this.engine.stop();
        this.engine = null;
      }
      if (this.game && this.game.map && typeof this.game.map.destroy === 'function') {
        this.game.map.destroy();
      }
      this.game = { exit: true };
      this.loaded = false;
      this.resetPartyState();
      this.chroniclesContext = context;
      this.screen = 'chronicles';
      bus.$emit('login:done');
    },
    handleChroniclesSetOut(scion = {}) {
      const scionName = typeof scion === 'string' ? scion : scion.name;
      if (!scionName || !Socket.rememberScion(scion)) {
        bus.$emit('player:chronicles:error', {
          message: 'Your authenticated session expired. Please log in again.',
        });
        return;
      }

      Socket.emit('player:chronicles:select', Socket.lastLoginPayload);
    },
    handlePermadeath(payload = {}) {
      if (this.permadeathHandled) {
        return true;
      }

      const lifecycle = payload.lifecycle || (payload.stats && payload.stats.lifecycle) || {};
      if (lifecycle.state !== 'permadead') {
        return false;
      }

      const state = loadHouses();
      const house = getActiveHouse(state);
      const scion = getActiveScion(state);
      if (!house || !scion || !scion.mortal) {
        return false;
      }

      this.permadeathHandled = true;
      const occurredAt = lifecycle.lastEvent && lifecycle.lastEvent.occurredAt;
      const occurredAtDate = occurredAt ? new Date(occurredAt) : null;
      const result = entombScion(state, house.id, scion.id, {
        level: Number.isFinite(payload.level)
          ? payload.level
          : (this.game && this.game.player ? this.game.player.level : scion.level),
        diedAt: occurredAtDate && Number.isFinite(occurredAtDate.getTime())
          ? occurredAtDate.toISOString()
          : undefined,
      });

      if (!result.ok || !saveHouses(result.state)) {
        this.permadeathHandled = false;
        this.clientErrorNotice = 'Your Scion fell, but the Chronicles could not be saved.';
        return false;
      }

      Socket.emit('player:chronicles:return', {
        houseId: house.id,
        scionId: scion.id,
      });
      return true;
    },
    getGameContainerRef() {
      return this.$refs.gameContainer || null;
    },
    getPaneHostComponent() {
      const container = this.getGameContainerRef();
      if (!container || !container.paneHostRef) {
        return null;
      }
      return container.paneHostRef.value || null;
    },
    getChatComponent() {
      const container = this.getGameContainerRef();
      if (!container || !container.chatboxRef) {
        return null;
      }
      return container.chatboxRef.value || null;
    },
    /**
     * Logout player
     */
    /**
     * The server replaced this session (login elsewhere). Return to the
     * login screen without fighting to reconnect; the next socket open
     * skips auto-relogin so the user decides.
     */
    sessionReplaced() {
      this.skipAutoRelogin = true;
      this.sessionNotice = 'Logged in from another window — this session was signed out.';
      setTimeout(() => { this.sessionNotice = ''; }, 12000);
      this.logout();
      // Let the socket itself reconnect (the login screen needs a live
      // socket to submit through); skipAutoRelogin stops the steal war.
      this.intentionalDisconnect = false;
    },
    logout() {
      // A user-chosen logout must not trigger the auto-reconnect loop.
      this.intentionalDisconnect = true;
      setTimeout(() => { this.intentionalDisconnect = false; }, 3000);

      if (this.game && this.game.map && typeof this.game.map.destroy === 'function') {
        this.game.map.destroy();
      }
      this.screen = 'login';
      this.chroniclesContext = null;
      this.permadeathHandled = false;
      this.game = { exit: true };
      this.layout.activePane = null;
      this.layout.leftPane = defaultPaneAssignments.left;
      this.layout.rightPane = defaultPaneAssignments.right;
      this.resetChatState();
      this.handleMapDimensions();
      this.resetPartyState();
    },

    /**
      * Cancel login
      */

    cancelLogin() {
      this.screen = 'main';
      this.layout.activePane = null;
      this.layout.leftPane = defaultPaneAssignments.left;
      this.layout.rightPane = defaultPaneAssignments.right;
      this.resetChatState();
      this.handleMapDimensions();
    },

    resetChatState() {
      this.cancelChatAutohide();
      this.layout.chat.isOpen = false;
      this.layout.chat.isPinned = false;
      this.layout.chat.unreadCount = 0;
      this.layout.chat.preview = DEFAULT_CHAT_PREVIEW;
    },

    resetPartyState() {
      resetPartyClientState(this);
    },

    onViewportResize() {
      if (typeof window === 'undefined') {
        return;
      }

      if (this.viewportResizeRaf) {
        window.cancelAnimationFrame(this.viewportResizeRaf);
      }

      this.viewportResizeRaf = window.requestAnimationFrame(() => {
        this.viewportResizeRaf = null;
        this.viewportWidth = window.innerWidth;
        this.viewportHeight = window.innerHeight;
      });
    },

    resolvePaneWidth(viewportWidth = this.viewportWidth) {
      if (this.layoutMode === 'mobile') {
        return Math.max(0, viewportWidth - (MOBILE_PANE_GUTTER * 2));
      }

      if (this.layoutMode === 'tablet') {
        return Math.min(viewportWidth * 0.44, 520);
      }

      return Math.min(Math.max(viewportWidth * 0.28, 420), 560);
    },

    applyWorldViewportToMap() {
      const mapInstance = this.game && this.game.map ? this.game.map : null;
      if (!mapInstance || typeof mapInstance.setViewportDimensions !== 'function') {
        return false;
      }

      const dimensions = mapInstance.setViewportDimensions(this.worldViewport);
      if (dimensions) {
        this.syncMapDimensionsFromPayload(dimensions);
      } else {
        this.syncMapDimensionsFromGame();
      }

      return true;
    },

    handleQuickSlot(slot, index) {
      if (!slot) {
        return;
      }

      if (slot.skillId) {
        const profile = getSkillExecutionProfile(slot.skillId) || {};
        const container = this.$refs.gameContainer;
        const dispatchOptions = {
          animationState: profile.animationState,
          duration: profile.duration,
          holdState: profile.holdState,
          modifiers: profile.modifiers || {},
        };

        let dispatched = false;
        if (container && typeof container.triggerSkill === 'function') {
          dispatched = container.triggerSkill(slot.skillId, dispatchOptions);
        }

        if (!dispatched && this.game && this.game.player) {
          const facing = typeof this.game.getFacingDirection === 'function'
            ? this.game.getFacingDirection()
            : (this.game.player.animation && this.game.player.animation.direction) || 'down';

          Socket.emit('player:skill:trigger', {
            id: this.game.player.uuid,
            skillId: slot.skillId,
            direction: facing,
            issuedAt: Date.now(),
            modifiers: dispatchOptions.modifiers || {},
            phase: 'start',
            animationState: dispatchOptions.animationState,
            duration: dispatchOptions.duration,
            holdState: dispatchOptions.holdState,
          });
        }
      }

      bus.$emit('quickbar:activate', {
        slot,
        index,
        game: this.game,
      });
      this.flashQuickbarSlot(index);
    },

    handleQuickbarRemap(slot, index) {
      bus.$emit('quickbar:remap', {
        slot,
        index,
        game: this.game,
      });
    },

    requestPane(pane) {
      if (!pane) {
        return;
      }
      this.openPane(pane);
    },

    getPanePreferredSide(pane) {
      if (this.layout.activePane === 'flowerOfLife') {
        if (pane === 'inventory') {
          return 'left';
        }
        if (pane === 'stats') {
          return 'right';
        }
      }

      const entry = paneRegistry[pane];
      if (!entry || !entry.slot) {
        return null;
      }
      return entry.slot === 'right' ? 'right' : 'left';
    },

    toggleSidePane(pane) {
      const side = this.getPanePreferredSide(pane);
      if (!side) {
        return false;
      }

      if (this.layout.leftPane === pane) {
        this.layout.leftPane = null;
        return true;
      }

      if (this.layout.rightPane === pane) {
        this.layout.rightPane = null;
        return true;
      }

      const key = side === 'right' ? 'rightPane' : 'leftPane';
      this.layout[key] = pane;
      return true;
    },

    openPane(pane) {
      bus.$emit('contextmenu:close');

      if (this.toggleSidePane(pane)) {
        return;
      }

      if (this.layout.activePane === pane) {
        this.closePane();
        return;
      }

      this.layout.activePane = pane;
      this.$nextTick(() => {
        this.focusActivePane();
      });
    },

    closePane(pane = null) {
      if (pane && this.layout.leftPane === pane) {
        this.layout.leftPane = null;
        return;
      }

      if (pane && this.layout.rightPane === pane) {
        this.layout.rightPane = null;
        return;
      }

      if (pane && this.layout.activePane === pane) {
        this.layout.activePane = null;
        return;
      }

      this.layout.activePane = null;
    },

    flashQuickbarSlot(index) {
      if (typeof window === 'undefined') {
        this.quickbarActiveIndex = index;
        return;
      }

      this.quickbarActiveIndex = index;
      if (this.quickbarFlashTimeout) {
        window.clearTimeout(this.quickbarFlashTimeout);
      }
      this.quickbarFlashTimeout = window.setTimeout(() => {
        this.quickbarActiveIndex = null;
        this.quickbarFlashTimeout = null;
      }, 200);
    },

    handleChatMessage(message = {}) {
      const preview = this.formatChatPreview(message);
      if (preview) {
        this.layout.chat.preview = preview;
      }

      if (!this.chatExpanded) {
        this.layout.chat.unreadCount += 1;
      } else {
        this.layout.chat.unreadCount = 0;
        if (!this.layout.chat.isPinned) {
          this.scheduleChatAutoHide();
        }
      }
    },

    handleChatHover(isHovering) {
      if (isHovering) {
        this.cancelChatAutohide();
      } else {
        this.scheduleChatAutoHide();
      }
    },

    formatChatPreview(message) {
      if (!message || !message.text) {
        return this.layout.chat.preview;
      }

      const text = String(message.text).trim();
      if (!text) {
        return this.layout.chat.preview;
      }

      if (message.type === 'chat' && message.username) {
        return `${message.username}: ${text}`;
      }

      return text;
    },

    toggleChat() {
      if (this.chatExpanded) {
        this.closeChat();
      } else {
        this.openChat();
      }
    },

    toggleChatPin() {
      this.layout.chat.isPinned = !this.layout.chat.isPinned;
      if (this.layout.chat.isPinned) {
        if (!this.layout.chat.isOpen) {
          this.openChat();
        } else {
          this.cancelChatAutohide();
        }
      } else if (this.layout.chat.isOpen) {
        this.scheduleChatAutoHide();
      }
    },

    openChat() {
      this.layout.chat.isOpen = true;
      this.layout.chat.unreadCount = 0;
      this.cancelChatAutohide();
      this.focusChatInput();
      if (!this.layout.chat.isPinned) {
        this.scheduleChatAutoHide();
      }
    },

    closeChat() {
      if (this.layout.chat.isPinned) {
        return;
      }
      this.layout.chat.isOpen = false;
      this.cancelChatAutohide();
    },

    scheduleChatAutoHide() {
      if (!this.layout.chat.isOpen || this.layout.chat.isPinned) {
        return;
      }
      if (this.chatAutoHideSeconds <= 0) {
        return;
      }

      const chatComponent = this.getChatComponent();
      if (chatComponent && typeof chatComponent.startCountdown === 'function') {
        chatComponent.startCountdown();
      }
    },

    cancelChatAutohide() {
      const chatComponent = this.getChatComponent();
      if (chatComponent && typeof chatComponent.stopCountdown === 'function') {
        chatComponent.stopCountdown();
      }
    },

    focusChatInput() {
      this.$nextTick(() => {
        const chatComponent = this.getChatComponent();
        if (!chatComponent) {
          return;
        }

        const root = chatComponent.$el || chatComponent;
        if (!root || typeof root.querySelector !== 'function') {
          return;
        }

        const input = root.querySelector('.chatbox__input');
        if (input && typeof input.focus === 'function') {
          input.focus();
        }
      });
    },

    activateQuickSlot(index) {
      const slot = this.quickSlots[index];
      if (!slot) {
        return;
      }
      this.handleQuickSlot(slot, index);
    },

    shouldIgnoreHotkeys(event) {
      const target = event && event.target;
      if (!target) {
        return false;
      }

      if (target.isContentEditable) {
        return true;
      }

      const { tagName } = target;
      return ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName);
    },

    focusActivePane() {
      const paneHost = this.getPaneHostComponent();
      if (!paneHost || !paneHost.$refs) {
        return;
      }

      const focusTargets = [];
      if (paneHost.$refs.overlayCard) {
        focusTargets.push(paneHost.$refs.overlayCard);
      }

      const selectors = [
        'button',
        '[href]',
        'input',
        'select',
        'textarea',
        '[tabindex]:not([tabindex="-1"])',
      ].join(', ');

      const getHostElement = (targetRef) => {
        if (!targetRef) {
          return null;
        }
        const candidate = Array.isArray(targetRef) ? targetRef[0] : targetRef;
        if (candidate instanceof HTMLElement) {
          return candidate;
        }
        if (candidate && candidate.$el instanceof HTMLElement) {
          return candidate.$el;
        }
        return null;
      };

      for (let i = 0; i < focusTargets.length; i += 1) {
        const element = getHostElement(focusTargets[i]);
        if (element) {
          const focusable = element.querySelector(selectors);
          if (focusable && typeof focusable.focus === 'function') {
            focusable.focus();
            break;
          }
        }
      }
    },

    handleGlobalKeydown(event) {
      if (event.defaultPrevented) {
        return;
      }

      if (event.key === 'Escape' || event.key === 'Esc') {
        if (this.layout.activePane) {
          event.stopPropagation();
          this.closePane();
          return;
        }

        if (this.layout.rightPane) {
          event.stopPropagation();
          this.layout.rightPane = null;
          return;
        }

        if (this.layout.leftPane) {
          event.stopPropagation();
          this.layout.leftPane = null;
          return;
        }

        if (this.chatExpanded && !this.layout.chat.isPinned) {
          event.stopPropagation();
          this.closeChat();
        }
        return;
      }

      if (!this.shouldIgnoreHotkeys(event)) {
        const key = String(event.key || '').toLowerCase();
        const paneHotkeys = {
          c: 'stats',
          i: 'inventory',
          p: 'flowerOfLife',
        };
        if (paneHotkeys[key]) {
          this.openPane(paneHotkeys[key]);
          event.preventDefault();
          return;
        }
      }

      if (shouldRootHandleQuickbarHotkey(event, this.shouldIgnoreHotkeys)) {
        const slotIndex = Number(event.key) - 1;
        this.activateQuickSlot(slotIndex);
        event.preventDefault();
        return;
      }

      if (event.key === '/' && !this.shouldIgnoreHotkeys(event)) {
        this.openChat();
        event.preventDefault();
      }
    },

    /**
     * Player movement, do something
     */
    playerMovement(data, meta = {}) {
      if (!this.game || !this.game.player) {
        return;
      }

      const payload = { ...data };
      if (payload.inventory && payload.inventory.slots) {
        payload.inventory = payload.inventory.slots;
      }

      const { player } = this.game;
      const isLocalPlayer = player.uuid === payload.uuid;

      const step = payload.movementStep || null;
      const stepSequence = step && typeof step.sequence === 'number' ? step.sequence : null;
      const animationMeta = meta.animation || payload.animation || null;

      const messageMeta = {
        sentAt: typeof meta.sentAt === 'number' ? meta.sentAt : null,
        receivedAt: now(),
      };

      const processEntity = (entity, controller) => {
        const lastSequence = typeof entity.lastMovementSequence === 'number'
          ? entity.lastMovementSequence
          : null;

        if (lastSequence !== null && stepSequence !== null && stepSequence <= lastSequence) {
          return { controller, accepted: false };
        }

        const applied = controller.applyServerStep(payload.x, payload.y, step, messageMeta);

        if (stepSequence !== null) {
          entity.lastMovementSequence = stepSequence;
        }

        return { controller, accepted: applied !== false };
      };

      if (isLocalPlayer) {
        if (!player.movement) {
          player.movement = new MovementController().initialise(player.x, player.y);
        }

        const { controller, accepted } = processEntity(player, player.movement);

        if (!accepted) {
          return;
        }

        if (accepted) {
          if (!Array.isArray(player.optimisticQueue)) {
            player.optimisticQueue = [];
          }

          if (player.optimisticQueue.length) {
            const matchIndex = player.optimisticQueue.findIndex((entry) => (
              entry.x === payload.x && entry.y === payload.y
            ));

            if (matchIndex !== -1) {
              player.optimisticQueue.splice(0, matchIndex + 1);
            } else {
              // Blocked step OR a position we never predicted (teleport,
              // server-side rejection, any desync): the server is
              // authoritative. Drop the stale predictions — a jammed queue
              // used to hit the 6-entry cap and silently eat all WASD input.
              player.optimisticQueue = [];
              if (typeof this.game.resetOptimisticMovement === 'function') {
                this.game.resetOptimisticMovement();
              }
            }
          }

          player.optimisticTarget = null;
          player.optimisticPosition = { x: payload.x, y: payload.y };

          if (typeof this.game.advanceOptimisticMovement === 'function') {
            this.game.advanceOptimisticMovement();
          }
        }

        Object.assign(player, payload, {
          movement: controller,
        });
        if (animationMeta) {
          this.game.updateActorAnimation(player, animationMeta);
        } else {
          this.game.ensureAnimationController(player);
        }
        this.game.map.player = player;
      } else {
        const playerIndex = this.game.map.players.findIndex((p) => p.uuid === payload.uuid);

        if (playerIndex === -1) {
          const newcomerController = new MovementController().initialise(payload.x, payload.y);
          newcomerController.applyServerStep(payload.x, payload.y, step, messageMeta);

          const newcomer = {
            ...payload,
            movement: newcomerController,
            lastMovementSequence: stepSequence,
          };
          this.game.updateActorAnimation(newcomer, animationMeta || payload.animation);
          this.game.map.players.push(newcomer);
          return;
        }

        const existing = this.game.map.players[playerIndex] || {};
        const controller = existing.movement
          || new MovementController().initialise(payload.x, payload.y);
        const { accepted } = processEntity(existing, controller);

        if (!accepted) {
          return;
        }

        const updated = {
          ...existing,
          ...payload,
          movement: controller,
          lastMovementSequence: stepSequence !== null
            ? stepSequence
            : existing.lastMovementSequence,
          animationController: existing.animationController,
        };
        if (animationMeta) {
          this.game.updateActorAnimation(updated, animationMeta);
        } else {
          this.game.ensureAnimationController(updated);
        }
        this.game.map.players[playerIndex] = updated;
      }
    },

    /**
     * On NPC movement, update NPCs
     */
    npcMovement(data, meta = {}) {
      if (!this.game || !this.game.map || typeof this.game.map.setNPCs !== 'function') {
        return;
      }

      this.game.map.setNPCs(data, meta);
      this.game.npcs = this.game.map.npcs;
    },

    monsterState(data, meta = {}) {
      if (!this.game || !this.game.map || typeof this.game.map.setMonsters !== 'function') {
        return;
      }

      this.game.map.setMonsters(data, meta);
      this.game.monsters = this.game.map.monsters;
    },

    combatHit(payload = {}) {
      if (!this.game || !this.game.map || typeof this.game.map.registerCombatHit !== 'function') {
        return;
      }

      this.game.map.registerCombatHit(payload);
      this.emitCombatLog(payload);
    },

    resolveCombatActorName(actorId, actorType = null, fallbackName = null) {
      if (!actorId || !this.game) {
        return fallbackName || 'Unknown';
      }

      const self = this.game.player;
      if (self && self.uuid === actorId) {
        return 'You';
      }

      const players = this.game.map && Array.isArray(this.game.map.players)
        ? this.game.map.players
        : [];
      const player = players.find((entry) => entry.uuid === actorId);
      if (player) {
        return player.username || fallbackName || 'Adventurer';
      }

      if (actorType === 'player') {
        return fallbackName || 'Adventurer';
      }

      const monsters = this.game.map && Array.isArray(this.game.map.monsters)
        ? this.game.map.monsters
        : [];
      const monster = monsters.find((entry) => entry.uuid === actorId);
      return monster ? monster.name || fallbackName || 'Monster' : fallbackName || 'Monster';
    },

    emitCombatLog(payload = {}) {
      if (!payload || !payload.targetId) {
        return;
      }

      const attacker = this.resolveCombatActorName(
        payload.attackerId,
        payload.attackerType,
        payload.attackerName,
      );
      const target = this.resolveCombatActorName(
        payload.targetId,
        payload.targetType,
        payload.targetName,
      );

      bus.$emit('combat:log', buildCombatLogEntry(payload, { attacker, target }));
    },

    async handleWorldSceneTransition(scene, playerState = {}, portal = null) {
      if (!scene || !this.game) {
        return;
      }

      await this.game.loadScene(scene, playerState);
      this.applyWorldViewportToMap();

      if (portal && portal.message) {
        bus.$emit('item:examine', {
          data: {
            type: 'normal',
            text: portal.message,
          },
        });
      }
    },

    pruneExpiredInvites() {
      const now = Date.now();
      this.partyInvites = this.partyInvites.filter((invite) => !invite.expiresAt || invite.expiresAt > now);
    },

    setPartyStatusMessage(message, duration = 4000) {
      if (this.partyStatusTimeout) {
        clearTimeout(this.partyStatusTimeout);
        this.partyStatusTimeout = null;
      }

      this.partyStatusMessage = message || '';

      if (message) {
        this.partyStatusTimeout = setTimeout(() => {
          this.partyStatusMessage = '';
          this.partyStatusTimeout = null;
        }, duration);
      }
    },

    handlePartyCreate() {
      Socket.emit('party:create');
    },

    handlePartyLeave() {
      Socket.emit('party:leave');
      this.resetPartyState();
    },

    handlePartyReadyToggle() {
      Socket.emit('party:ready');
    },

    handlePartyStartInstance() {
      Socket.emit('party:startInstance');
    },

    handleEnterZone(selection) {
      const { template, layout } = selection || {};
      Socket.emit('instance:enterSolo', { template, layout });
    },

    handlePartyReturnToTown() {
      Socket.emit('party:returnToTown');
    },

    handlePartyInviteRequest(payload) {
      const username = payload && payload.username ? payload.username.trim() : '';
      if (!username) {
        return;
      }

      Socket.emit('party:invite', { username });
    },

    handlePartyAcceptInvite(invite) {
      if (!invite || !invite.partyId) {
        return;
      }

      Socket.emit('party:invite:accept', { partyId: invite.partyId });
      this.partyInvites = this.partyInvites.filter((entry) => entry.partyId !== invite.partyId);
    },

    handlePartyDeclineInvite(invite) {
      if (!invite || !invite.partyId) {
        return;
      }

      Socket.emit('party:invite:decline', { partyId: invite.partyId });
      this.partyInvites = this.partyInvites.filter((entry) => entry.partyId !== invite.partyId);
    },

    handlePartyUpdate(party, meta = {}) {
      this.pruneExpiredInvites();
      this.party = party;
      if (party) {
        this.partyInvites = this.partyInvites.filter((invite) => invite.partyId !== party.id);
      }

      if (!party || party.state !== 'instance') {
        this.partyLoading = { active: false, state: null };
      }
    },

    handlePartyInvite(invite) {
      if (!invite || !invite.partyId) {
        return;
      }

      this.pruneExpiredInvites();
      const now = Date.now();
      const expiresAt = invite.expiresAt || (now + 60000);
      const filtered = this.partyInvites.filter((entry) => entry.partyId !== invite.partyId);
      this.partyInvites = [...filtered, { ...invite, expiresAt }];
      this.setPartyStatusMessage(`Party invite from ${invite.invitedBy || 'Unknown'}`);
    },

    handlePartyLoading(state) {
      const active = Boolean(state && state !== 'idle');
      this.partyLoading = { active, state };
      if (active) {
        this.setPartyStatusMessage('');
      }
    },

    async handlePartySceneTransition(scene, playerState = {}, partySnapshot = null) {
      if (!scene || !this.game) {
        return;
      }

      await this.game.loadScene(scene, playerState);
      this.applyWorldViewportToMap();

      if (partySnapshot) {
        this.party = partySnapshot;
      }

      this.partyLoading = { active: false, state: null };
    },

    handlePartyError(error = {}) {
      if (!error || !error.message) {
        return;
      }

      this.setPartyStatusMessage(error.message);
    },

    handlePartyInstanceComplete(payload = {}) {
      if (payload.party) {
        this.party = payload.party;
      }

      const rewards = Array.isArray(payload.rewards) ? payload.rewards : [];

      if (rewards.length) {
        const summary = rewards
          .map((entry) => {
            if (!entry || !entry.username) {
              return null;
            }

            const coinText = Number.isFinite(entry.coins) ? `${entry.coins} coins` : null;
            const experienceText = entry.experience && entry.experience.amount
              ? `${entry.experience.amount} ${entry.experience.skill || 'XP'}`
              : null;
            const rewardText = [coinText, experienceText].filter(Boolean).join(', ');
            return rewardText ? `${entry.username}: ${rewardText}` : entry.username;
          })
          .filter(Boolean)
          .join('; ');

        const message = summary
          ? `Instance complete! Rewards distributed — ${summary}.`
          : 'Instance complete! Rewards distributed.';
        this.setPartyStatusMessage(message, 8000);
      } else if (payload.message) {
        this.setPartyStatusMessage(payload.message, 6000);
      } else {
        this.setPartyStatusMessage('Instance complete! Returning to town...', 6000);
      }
    },

    /**
     * Start the whole game
     */
    async startGame(data) {
      // Stop the main menu music
      bus.$emit('music:stop');

      // Re-entry safe (auto re-login after a reconnect): stop the previous
      // engine and map before building fresh ones, or two rAF loops fight
      // over the canvas.
      if (this.engine) {
        this.engine.stop();
        this.engine = null;
      }
      if (this.game && this.game.map && typeof this.game.map.destroy === 'function') {
        this.game.map.destroy();
      }

      // Initialise client state immediately
      this.game = new Client(data);

      // A hard-mode death is submitted to persistence immediately. If the
      // connection drops before the live stats event reaches this client,
      // the login snapshot must still close the Scion's record rather than
      // briefly rebuilding a dead world and accidentally reviving on relog.
      const initialLifecycle = this.game.player
        && (this.game.player.lifecycle
          || (this.game.player.stats && this.game.player.stats.lifecycle));
      if (initialLifecycle && initialLifecycle.state === 'permadead'
        && this.handlePermadeath({
          lifecycle: initialLifecycle,
          level: this.game.player.level,
        })) {
        return;
      }

      // Ensure the game view is mounted so the canvas exists before building the map
      if (!this.loaded) {
        this.loaded = true;
      }
      await this.$nextTick();

      await this.game.buildMap();
      this.game.monsters = this.game.map.monsters;
      if (!this.applyWorldViewportToMap()) {
        this.syncMapDimensionsFromGame();
      }

      // Start game engine
      this.engine = new Engine(this.game);
      this.engine.start();

      // Focus on game.
      setTimeout(() => {
        window.focusOnGame();
      }, 250);

      // Clear login procedure
      bus.$emit('login:done');
      this.screen = 'game';
      this.chroniclesContext = null;
      this.permadeathHandled = false;
      this.resetChatState();
    },
    /**
     * A click-handler event that does nothing, really.
     *
     * @param {MouseEvent} event The mouse event
     */
    nothing(event) {
      // Make right-click system for
      // rest of the game view.
      event.preventDefault();
    },
    showSidebar(selectedSlot) {
      const slotMap = {
        0: 'stats',
        1: 'inventory',
        2: 'wear',
        3: 'friendlist',
        4: 'settings',
        5: 'logout',
        6: 'quests',
      };

      const pane = slotMap[selectedSlot];
      if (pane) {
        this.openPane(pane);
      }
    },
    handleMapDimensions(dimensions = null) {
      if (!dimensions) {
        this.mapDimensions = getInitialMapDimensions(this.config.map);
        return;
      }
      this.syncMapDimensionsFromPayload(dimensions);
    },
    syncMapDimensionsFromPayload(dimensions = {}) {
      const fallback = getInitialMapDimensions(this.config.map);
      const width = Number.isFinite(dimensions.width) && dimensions.width > 0 ? dimensions.width : fallback.width;
      const height = Number.isFinite(dimensions.height) && dimensions.height > 0 ? dimensions.height : fallback.height;
      const scale = Number.isFinite(dimensions.scale) && dimensions.scale > 0 ? dimensions.scale : fallback.scale;
      const displayWidth = Number.isFinite(dimensions.displayWidth) && dimensions.displayWidth > 0
        ? dimensions.displayWidth
        : width * scale;
      const displayHeight = Number.isFinite(dimensions.displayHeight) && dimensions.displayHeight > 0
        ? dimensions.displayHeight
        : height * scale;

      this.mapDimensions = {
        width,
        height,
        displayWidth,
        displayHeight,
        scale,
      };
    },
    syncMapDimensionsFromGame() {
      const mapInstance = this.game && this.game.map ? this.game.map : null;
      if (!mapInstance || !mapInstance.config || !mapInstance.config.map) {
        this.handleMapDimensions();
        return;
      }

      const mapConfig = mapInstance.config.map;
      const tile = mapConfig?.tileset?.tile || { width: 32, height: 32 };
      const viewport = mapConfig?.viewport || { x: 24, y: 15 };
      const width = (tile.width || 0) * (viewport.x || 0);
      const height = (tile.height || 0) * (viewport.y || 0);
      const scale = typeof mapInstance.scale === 'number' && mapInstance.scale > 0 ? mapInstance.scale : 1;

      this.syncMapDimensionsFromPayload({
        width,
        height,
        displayWidth: width * scale,
        displayHeight: height * scale,
        scale,
      });
    },
  },
};
</script>

<style lang="scss" scoped>
@use '@/assets/scss/abstracts/tokens' as *;

#app {
  font-family: 'GameFont', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--color-text-primary);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
  background: var(--color-bg-primary);
  overflow: hidden;

  .wrapper {
    width: 100%;
    box-sizing: border-box;
  }
}

.connection-banner--error {
  background: rgba(150, 90, 20, 0.92) !important;
}

.connection-banner {
  position: fixed;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  padding: 6px 14px;
  border-radius: 4px;
  background: rgba(120, 30, 30, 0.92);
  color: #ffe9e0;
  font-family: 'GameFont', sans-serif;
  font-size: 13px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}
</style>
