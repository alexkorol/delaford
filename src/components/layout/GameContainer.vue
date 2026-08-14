<template>
  <div
    class="wrapper game-container"
    :class="gameContainerClasses"
    @contextmenu.prevent="handleRightClick"
  >
    <PaneHost
      ref="paneHostRef"
      class="game-container__stage"
      :layout-mode="layoutMode"
      :game="game"
      :registry="paneRegistry"
      :left-pane="defaultLeftPane"
      :right-pane="defaultRightPane"
      :overlay-pane="activeOverlayDescriptor"
      @overlay-close="$emit('overlay-close', $event)"
      @request-pane="$emit('request-pane', $event)"
    >
      <div class="game-container__center">
        <div
          class="game-container__world-shell"
          :style="worldShellStyle"
        >
          <div
            ref="stageShellRef"
            class="game-container__stage-shell"
            @click.self="refocusGame"
          >
            <GameCanvas
              ref="canvasRef"
              :game="game"
              :world-viewport="worldViewport"
              @pane-state="legacyPaneOpen = $event"
            />
            <div
              v-if="partyLoading.active"
              class="game-container__loading-screen"
              role="status"
              aria-live="polite"
            >
              <span class="game-container__loading-rune" aria-hidden="true">&#9671;</span>
              <strong>{{ loadingMessage }}</strong>
              <span>The road is taking shape</span>
            </div>
            <WorldMinimap
              v-if="!uiHidden && !legacyPaneOpen && !hasDockedPane"
              :game="game"
            />
            <div
              v-if="!uiHidden"
              class="game-container__party-overlay"
            >
              <nav class="game-container__pane-menu" aria-label="Game panels">
                <button
                  type="button"
                  class="game-container__party-toggle"
                  title="Quest journal (J)"
                  @click="$emit('request-pane', 'quests')"
                >
                  Quests
                </button>
                <button
                  type="button"
                  class="game-container__party-toggle"
                  @click="$emit('request-pane', 'settings')"
                >
                  Settings
                </button>
                <button
                  type="button"
                  class="game-container__party-toggle"
                  @click="$emit('request-pane', 'logout')"
                >
                  Exit
                </button>
              </nav>
              <nav class="game-container__world-actions" aria-label="World actions">
                <button
                  type="button"
                  class="game-container__party-toggle"
                  @click="partyOpen = !partyOpen"
                >
                  Party{{ partyInvites.length ? ` (${partyInvites.length})` : '' }}
                </button>
                <button
                  type="button"
                  class="game-container__party-toggle"
                  @click="toggleAdventure"
                >
                  Adventure
                </button>
                <button
                  type="button"
                  class="game-container__party-toggle"
                  @click="toggleRoads"
                >
                  Roads
                </button>
              </nav>
              <PartyPanel
                v-if="partyOpen || partyInvites.length"
                :player-id="game && game.player ? game.player.uuid : null"
                :party="party"
                :invites="partyInvites"
                :loading="partyLoading"
                :status-message="partyStatusMessage"
                @create="$emit('party-create')"
                @leave="$emit('party-leave')"
                @toggle-ready="$emit('party-toggle-ready')"
                @start-instance="$emit('party-start-instance')"
                @return-to-town="$emit('party-return-to-town')"
                @invite="$emit('party-invite', $event)"
                @accept-invite="$emit('party-accept-invite', $event)"
                @decline-invite="$emit('party-decline-invite', $event)"
              />
              <div
                v-if="adventureOpen"
                class="game-container__zone-menu"
                aria-label="Choose a zone"
              >
                <div class="game-container__zone-heading">
                  <p class="game-container__zone-title">Choose an expedition</p>
                  <span class="game-container__zone-player-level">You: Lv {{ playerProgress.level }}</span>
                </div>
                <button
                  v-for="zone in adventureZones"
                  :key="zone.id"
                  type="button"
                  class="game-container__zone"
                  :class="zoneClasses(zone)"
                  @click="enterZone(zone)"
                >
                  <span class="game-container__zone-copy">
                    <span class="game-container__zone-name">{{ zone.name }}</span>
                    <span class="game-container__zone-note">{{ zone.note }}</span>
                  </span>
                  <span class="game-container__zone-meta">
                    <span class="game-container__zone-status">{{ zoneStatus(zone) }}</span>
                    <span class="game-container__zone-level">Lv {{ zone.levelHint }}</span>
                  </span>
                </button>
              </div>
              <div
                v-if="roadsOpen"
                class="game-container__zone-menu"
                aria-label="Choose a road"
              >
                <p class="game-container__zone-title">Read the chart of…</p>
                <button
                  v-for="road in roads"
                  :key="road.id"
                  type="button"
                  class="game-container__zone"
                  @click="openRoad(road)"
                >
                  <span class="game-container__zone-name">{{ road.name }}</span>
                  <span class="game-container__zone-level">{{ road.direction }}</span>
                </button>
              </div>
            </div>
            <div
              v-if="!uiHidden && !legacyPaneOpen && !chatExpanded"
              ref="chatPeekRef"
              class="game-container__chat-peek"
              :class="{ 'game-container__chat-peek--dragging': isChatDragging }"
              :style="chatDockStyle"
              aria-label="Message log preview"
              title="Double-click to reset message log position"
              @dblclick.stop.prevent="resetChatDock"
            >
              <button
                type="button"
                class="game-container__chat-peek-main"
                :aria-label="chatToggleLabel || 'Show chat'"
                @pointerdown.stop.prevent="beginChatDrag"
                @mousedown.stop.prevent="beginChatDrag"
                @click="handleChatPeekMainClick"
              >
                <span class="game-container__chat-peek-label">
                  {{ chatPreview || 'Chat' }}
                </span>
                <span
                  v-if="chatUnreadCount > 0"
                  class="game-container__chat-peek-count"
                >
                  {{ chatUnreadCount }}
                </span>
              </button>
              <button
                type="button"
                class="game-container__chat-peek-move"
                aria-label="Move message log to next corner"
                title="Move message log"
                @pointerdown.stop.prevent="beginChatDrag"
                @mousedown.stop.prevent="beginChatDrag"
                @dblclick.stop.prevent="resetChatDock"
                @click.stop="handleChatCycleClick"
              >
                <span aria-hidden="true" />
              </button>
            </div>
            <div
              v-if="!uiHidden && !legacyPaneOpen"
              ref="chatOverlayRef"
              class="game-container__chat-overlay"
              :class="{ 'game-container__chat-overlay--collapsed': !chatExpanded }"
              :style="chatDockStyle"
            >
              <div
                class="game-container__chat-drag-handle"
                :class="{ 'game-container__chat-drag-handle--dragging': isChatDragging }"
                aria-label="Move message log"
                title="Move message log"
                @pointerdown.stop.prevent="beginChatDrag"
                @mousedown.stop.prevent="beginChatDrag"
                @dblclick.stop.prevent="resetChatDock"
              >
                <span class="game-container__chat-grip" aria-hidden="true" />
                <button
                  type="button"
                  class="game-container__chat-dock-cycle"
                  aria-label="Move message log to next corner"
                  title="Move message log to next corner"
                  @pointerdown.stop
                  @click.stop="handleChatCycleClick"
                >
                  <span aria-hidden="true" />
                </button>
              </div>
              <Chatbox
                ref="chatboxRef"
                :game="game"
                :layout-mode="layoutMode"
                :pinned="chatPinned"
                :collapsed="!chatExpanded"
                :unread-count="chatUnreadCount"
                :auto-hide-seconds="chatAutoHideSeconds"
                @message-appended="$emit('chat-message', $event)"
                @toggle-pin="$emit('toggle-chat-pin')"
                @hover-state="$emit('chat-hover', $event)"
                @countdown-complete="$emit('chat-countdown-complete')"
              />
            </div>
          </div>
          <GameHUD
            ref="hudRef"
            class="game-container__hud"
            :player-vitals="playerVitals"
            :player-progress="playerProgress"
            :quick-slots="quickSlots"
            :quickbar-active-index="quickbarActiveIndex"
            :quickbar-cooldowns="quickbarCooldowns"
            @quick-slot="handleQuickSlot"
          />
        </div>
      </div>
    </PaneHost>

    <ContextMenu :game="game" />
  </div>
</template>

<script>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import PaneHost from '../ui/panes/PaneHost.vue';
import GameCanvas from '../GameCanvas.vue';
import Chatbox from '../Chatbox.vue';
import ContextMenu from '../sub/ContextMenu.vue';
import PartyPanel from '../ui/world/PartyPanel.vue';
import GameHUD from './GameHUD.vue';
import WorldMinimap from '../hud/WorldMinimap.vue';

export default {
  name: 'GameContainer',
  components: {
    PaneHost,
    GameCanvas,
    Chatbox,
    ContextMenu,
    PartyPanel,
    GameHUD,
    WorldMinimap,
  },
  props: {
    game: {
      type: Object,
      required: true,
    },
    layoutMode: {
      type: String,
      default: 'desktop',
    },
    paneRegistry: {
      type: Object,
      default: () => ({}),
    },
    defaultLeftPane: {
      type: String,
      default: null,
    },
    defaultRightPane: {
      type: String,
      default: null,
    },
    activeOverlayDescriptor: {
      type: Object,
      default: () => ({ id: null, title: '' }),
    },
    worldShellStyle: {
      type: Object,
      default: () => ({}),
    },
    worldViewport: {
      type: Object,
      default: () => ({ x: 24, y: 15, scale: 1 }),
    },
    playerVitals: {
      type: Object,
      required: true,
    },
    playerProgress: {
      type: Object,
      default: () => ({ level: 1, fraction: 0 }),
    },
    quickSlots: {
      type: Array,
      default: () => [],
    },
    quickbarActiveIndex: {
      type: Number,
      default: null,
    },
    quickbarCooldowns: {
      type: Object,
      default: () => ({}),
    },
    party: {
      type: Object,
      default: null,
    },
    partyInvites: {
      type: Array,
      default: () => [],
    },
    partyLoading: {
      type: Object,
      default: () => ({ active: false, state: null }),
    },
    partyStatusMessage: {
      type: String,
      default: '',
    },
    isDesktop: {
      type: Boolean,
      default: false,
    },
    chatShellClasses: {
      type: Object,
      default: () => ({}),
    },
    chatToggleLabel: {
      type: String,
      default: '',
    },
    chatPreview: {
      type: String,
      default: '',
    },
    chatUnreadCount: {
      type: Number,
      default: 0,
    },
    chatPinned: {
      type: Boolean,
      default: false,
    },
    chatExpanded: {
      type: Boolean,
      default: false,
    },
    chatAutoHideSeconds: {
      type: Number,
      default: 0,
    },
  },
  emits: [
    'right-click',
    'overlay-close',
    'quick-slot',
    'request-pane',
    'party-create',
    'party-leave',
    'party-toggle-ready',
    'party-start-instance',
    'party-return-to-town',
    'party-invite',
    'party-accept-invite',
    'party-decline-invite',
    'enter-zone',
    'toggle-chat',
    'toggle-chat-pin',
    'chat-hover',
    'chat-countdown-complete',
    'chat-message',
  ],
  setup(props, { emit, expose }) {
    const paneHostRef = ref(null);
    const stageShellRef = ref(null);
    const chatboxRef = ref(null);
    const chatOverlayRef = ref(null);
    const chatPeekRef = ref(null);
    const canvasRef = ref(null);
    const hudRef = ref(null);
    const chatPosition = ref(null);
    const chatDockIndex = ref(0);
    const isChatDragging = ref(false);
    const chatDragMoved = ref(false);
    const suppressChatCycleClick = ref(false);
    let stopChatDrag = null;
    let chatPeekClickTimer = null;
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

    const handleRightClick = (event) => {
      emit('right-click', event);
    };

    const refocusGame = () => {
      if (typeof window.focusOnGame === 'function') {
        window.focusOnGame();
      }
    };

    const handleQuickSlot = (slot, index) => {
      emit('quick-slot', slot, index);
    };

    const triggerSkill = (skillId, options = {}) => {
      if (!skillId) {
        return false;
      }

      const canvasComponent = canvasRef.value;
      if (canvasComponent && typeof canvasComponent.dispatchSkill === 'function') {
        canvasComponent.dispatchSkill(skillId, options);
        return true;
      }

      return false;
    };

    const closeLegacyPane = () => {
      if (!legacyPaneOpen.value) return false;
      canvasRef.value?.closePane?.();
      return true;
    };

    const uiHidden = ref(false);
    const legacyPaneOpen = ref(false);
    const partyOpen = ref(false);
    const adventureOpen = ref(false);
    const roadsOpen = ref(false);
    const hasDockedPane = computed(() => Boolean(
      props.defaultLeftPane
      || props.defaultRightPane
      || props.activeOverlayDescriptor?.id,
    ));
    const loadingMessage = computed(() => (
      props.partyLoading?.state === 'enter-instance'
        ? 'Entering the expedition…'
        : 'Preparing the road…'
    ));

    // The four roads out of the Crossroads (server: world-web.js ROADS).
    // Each opens that road's Wayfinder's Chart; travel happens from the chart.
    const roads = [
      { id: 'tin', name: 'The Tin Road', direction: 'north' },
      { id: 'salt', name: 'The Salt Road', direction: 'east' },
      { id: 'chalk', name: 'The Chalk Road', direction: 'south' },
      { id: 'copper', name: 'The Copper Road', direction: 'west' },
    ];

    const openRoad = (road) => {
      roadsOpen.value = false;
      emit('enter-zone', { road: road.id });
    };

    // Solo Adventure zones must match the server's ADVENTURE_ZONES; each
    // pairs an art template with a layout shape, both validated server-side.
    const adventureZones = [
      { id: 'old-barrow', name: 'The Old Barrow', note: 'Tight halls · forgiving first delve', template: 'dungeon', layout: 'warren', minLevel: 1, maxLevel: 5, levelHint: '1–5' },
      { id: 'verdant-grove', name: 'Verdant Grove', note: 'Open clearings · roaming packs', template: 'grove', layout: 'clearings', minLevel: 1, maxLevel: 6, levelHint: '1–6' },
      { id: 'sunken-colonnade', name: 'Sunken Colonnade', note: 'A narrow, punishing gauntlet', template: 'crypt', layout: 'gauntlet', minLevel: 3, maxLevel: 8, levelHint: '3–8' },
      { id: 'weir-crypt', name: 'Weir Crypt', note: 'Dense rooms · little retreat', template: 'crypt', layout: 'warren', minLevel: 4, maxLevel: 9, levelHint: '4–9' },
      { id: 'the-wilds', name: 'The Wilds', note: 'Broad hunting grounds', template: 'wilds', layout: 'clearings', minLevel: 6, maxLevel: 12, levelHint: '6–12' },
      { id: 'marsh-of-reeds', name: 'Marsh of Reeds', note: 'Hostile wetlands · elite packs', template: 'marsh', layout: 'clearings', minLevel: 8, maxLevel: 14, levelHint: '8–14' },
    ];

    const zoneStatus = (zone) => {
      const level = Number(props.playerProgress?.level) || 1;
      if (level < zone.minLevel) return 'Danger';
      if (zone.id === 'old-barrow' && level <= 2) return 'Start here';
      if (level > zone.maxLevel) return 'Low threat';
      return 'Ready';
    };

    const zoneClasses = zone => ({
      'game-container__zone--recommended': zoneStatus(zone) === 'Start here',
      'game-container__zone--danger': zoneStatus(zone) === 'Danger',
      'game-container__zone--outlevelled': zoneStatus(zone) === 'Low threat',
    });

    const enterZone = (zone) => {
      adventureOpen.value = false;
      emit('enter-zone', { template: zone.template, layout: zone.layout });
    };

    const toggleAdventure = () => {
      adventureOpen.value = !adventureOpen.value;
      if (adventureOpen.value) roadsOpen.value = false;
    };

    const toggleRoads = () => {
      roadsOpen.value = !roadsOpen.value;
      if (roadsOpen.value) adventureOpen.value = false;
    };

    const activeChatDock = () => (props.chatExpanded ? chatOverlayRef.value : chatPeekRef.value);

    const getChatBounds = (stage, dock) => {
      const stageRect = stage.getBoundingClientRect();
      const dockRect = dock.getBoundingClientRect();
      const padding = 8;
      const hudElement = hudRef.value && (hudRef.value.$el || hudRef.value);
      const hudRect = hudElement && typeof hudElement.getBoundingClientRect === 'function'
        ? hudElement.getBoundingClientRect()
        : null;
      const bottomClearance = hudRect
        ? Math.max(0, stageRect.bottom - hudRect.top + padding)
        : 0;
      const maxLeft = Math.max(padding, stageRect.width - dockRect.width - padding);
      const maxTop = Math.max(padding, stageRect.height - dockRect.height - padding - bottomClearance);

      return {
        padding,
        stageRect,
        dockRect,
        minLeft: padding,
        minTop: padding,
        maxLeft,
        maxTop,
      };
    };

    const getLeftTopDockY = (stage, bounds) => {
      const minimap = stage.querySelector('.world-minimap');
      if (!minimap) {
        return bounds.minTop;
      }

      const minimapRect = minimap.getBoundingClientRect();
      return clamp(
        minimapRect.bottom - bounds.stageRect.top + bounds.padding,
        bounds.minTop,
        bounds.maxTop,
      );
    };

    const setDefaultChatDock = () => {
      if (chatPosition.value) {
        return;
      }

      const stage = stageShellRef.value;
      const dock = activeChatDock();
      if (!stage || !dock) {
        return;
      }

      const bounds = getChatBounds(stage, dock);
      chatDockIndex.value = 3;
      chatPosition.value = {
        x: bounds.minLeft,
        y: getLeftTopDockY(stage, bounds),
      };
    };

    const resetChatDock = () => {
      if (chatPeekClickTimer) {
        window.clearTimeout(chatPeekClickTimer);
        chatPeekClickTimer = null;
      }
      chatPosition.value = null;
      chatDockIndex.value = 3;
      nextTick(() => setDefaultChatDock());
    };

    const cleanupChatDrag = () => {
      if (stopChatDrag) {
        stopChatDrag();
        stopChatDrag = null;
      }
      isChatDragging.value = false;
    };

    const beginChatDrag = (event) => {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }

      const stage = stageShellRef.value;
      const dock = activeChatDock();
      if (!stage || !dock) {
        return;
      }

      cleanupChatDrag();
      const bounds = getChatBounds(stage, dock);
      const dockRect = dock.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const startLeft = dockRect.left - bounds.stageRect.left;
      const startTop = dockRect.top - bounds.stageRect.top;

      isChatDragging.value = true;
      chatDragMoved.value = false;
      if (
        Number.isFinite(event.pointerId)
        && event.currentTarget
        && typeof event.currentTarget.setPointerCapture === 'function'
      ) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }

      const usingMouseFallback = event.type === 'mousedown';
      const moveEventNames = usingMouseFallback ? ['mousemove'] : ['pointermove'];
      const upEventNames = usingMouseFallback ? ['mouseup'] : ['pointerup'];
      const cancelEventNames = usingMouseFallback ? ['mouseleave'] : ['pointercancel', 'mouseleave'];

      const handleMove = (moveEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        if (Math.abs(deltaX) + Math.abs(deltaY) > 4) {
          chatDragMoved.value = true;
        }
        chatPosition.value = {
          x: clamp(startLeft + deltaX, bounds.minLeft, bounds.maxLeft),
          y: clamp(startTop + deltaY, bounds.minTop, bounds.maxTop),
        };
      };

      const handleUp = () => {
        const wasDragged = chatDragMoved.value;
        cleanupChatDrag();
        if (wasDragged) {
          suppressChatCycleClick.value = true;
          window.setTimeout(() => {
            suppressChatCycleClick.value = false;
          }, 120);
        }
      };

      moveEventNames.forEach(name => window.addEventListener(name, handleMove));
      upEventNames.forEach(name => window.addEventListener(name, handleUp, { once: true }));
      cancelEventNames.forEach(name => window.addEventListener(name, handleUp, { once: true }));
      stopChatDrag = () => {
        moveEventNames.forEach(name => window.removeEventListener(name, handleMove));
        upEventNames.forEach(name => window.removeEventListener(name, handleUp));
        cancelEventNames.forEach(name => window.removeEventListener(name, handleUp));
      };
    };

    const dockChatToIndex = (index) => {
      const stage = stageShellRef.value;
      const dock = activeChatDock();
      if (!stage || !dock) {
        return;
      }

      const bounds = getChatBounds(stage, dock);
      const leftTopY = getLeftTopDockY(stage, bounds);
      const positions = [
        { x: bounds.minLeft, y: bounds.maxTop },
        { x: bounds.maxLeft, y: bounds.maxTop },
        { x: bounds.maxLeft, y: bounds.minTop },
        { x: bounds.minLeft, y: leftTopY },
      ];

      chatDockIndex.value = index;
      chatPosition.value = positions[index];
    };

    const cycleChatDock = () => {
      dockChatToIndex((chatDockIndex.value + 1) % 4);
    };

    const handleChatCycleClick = () => {
      if (suppressChatCycleClick.value) {
        suppressChatCycleClick.value = false;
        return;
      }
      cycleChatDock();
    };

    const handleChatPeekMainClick = (event) => {
      if (suppressChatCycleClick.value) {
        suppressChatCycleClick.value = false;
        return;
      }
      if (event && event.detail > 1) {
        return;
      }
      if (chatPeekClickTimer) {
        window.clearTimeout(chatPeekClickTimer);
      }
      chatPeekClickTimer = window.setTimeout(() => {
        chatPeekClickTimer = null;
        emit('toggle-chat');
      }, 180);
    };

    const chatDockStyle = computed(() => {
      if (!chatPosition.value) {
        return {};
      }

      return {
        left: `${chatPosition.value.x}px`,
        top: `${chatPosition.value.y}px`,
        bottom: 'auto',
      };
    });

    onMounted(() => {
      nextTick(() => setDefaultChatDock());
    });

    watch(
      () => props.chatExpanded,
      () => {
        nextTick(() => {
          if (!chatPosition.value) {
            setDefaultChatDock();
            return;
          }

          const stage = stageShellRef.value;
          const dock = activeChatDock();
          if (!stage || !dock) {
            return;
          }

          const bounds = getChatBounds(stage, dock);
          chatPosition.value = {
            x: clamp(chatPosition.value.x, bounds.minLeft, bounds.maxLeft),
            y: clamp(chatPosition.value.y, bounds.minTop, bounds.maxTop),
          };
        });
      },
    );

    onBeforeUnmount(() => {
      cleanupChatDrag();
      if (chatPeekClickTimer) {
        window.clearTimeout(chatPeekClickTimer);
        chatPeekClickTimer = null;
      }
    });

    expose({
      paneHostRef,
      chatboxRef,
      canvasRef,
      triggerSkill,
      refocusGame,
      closeLegacyPane,
    });

    return {
      paneHostRef,
      stageShellRef,
      chatboxRef,
      chatOverlayRef,
      chatPeekRef,
      canvasRef,
      hudRef,
      handleRightClick,
      handleQuickSlot,
      triggerSkill,
      uiHidden,
      legacyPaneOpen,
      hasDockedPane,
      loadingMessage,
      partyOpen,
      adventureOpen,
      roadsOpen,
      adventureZones,
      zoneStatus,
      zoneClasses,
      enterZone,
      toggleAdventure,
      toggleRoads,
      roads,
      openRoad,
      beginChatDrag,
      resetChatDock,
      cycleChatDock,
      handleChatCycleClick,
      handleChatPeekMainClick,
      isChatDragging,
      chatDockStyle,
      refocusGame,
      gameContainerClasses: computed(() => ({
        'game-container--ui-hidden': uiHidden.value,
        'game-container--left-pane-open': Boolean(props.defaultLeftPane),
        'game-container--right-pane-open': Boolean(props.defaultRightPane),
        'game-container--both-panes-open': Boolean(props.defaultLeftPane && props.defaultRightPane),
      })),
    };
  },
};
</script>

<style scoped lang="scss">
@use '@/assets/scss/abstracts/tokens' as *;

.game-container {
  /* PoE-style: panes cover up to half the screen and overlay the world */
  --arpg-pane-width: clamp(560px, 48vw, 1100px);
  --arpg-pane-gutter: 8px;
  --arpg-stage-top: 8px;
  --arpg-stage-bottom: 8px;
  --arpg-center-left: var(--arpg-pane-gutter);
  --arpg-center-right: var(--arpg-pane-gutter);
  --hud-orb-size: clamp(136px, 11vw, 168px);
  --hud-chat-inset: 12px;
  --hud-chat-clearance: calc(var(--hud-orb-size) * 0.78);

  flex: 1 1 auto;
  display: flex;
  justify-content: center;
  align-items: stretch;
  position: relative;
  padding: 4px;
  width: 100%;
  min-height: 0;
  box-sizing: border-box;
  background: var(--color-bg-primary);
  overflow: hidden;
}

/* Panes overlay the world instead of squeezing it (PoE-style) —
   the world shell stays centered regardless of open panes. */

.game-container__stage {
  display: flex;
  flex: 1 1 auto;
}

.game-container__center {
  position: fixed;
  top: var(--arpg-stage-top);
  right: var(--arpg-center-right);
  bottom: var(--arpg-stage-bottom);
  left: var(--arpg-center-left);
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: auto;
  min-height: 0;
  gap: var(--space-sm);
  pointer-events: none;
  transition: left 180ms ease-out, right 180ms ease-out;
}

.game-container__world-shell {
  position: relative;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  padding: 4px;
  gap: var(--space-xs);
  width: var(--world-display-width, 1120px);
  max-width: none;
  max-height: 100%;
  margin: 0 auto;
  border-radius: var(--radius-md);
  background: #141210;
  border: 2px solid var(--color-frame-dark);
  border-top-color: var(--color-bevel-light);
  border-left-color: var(--color-bevel-light);
  box-shadow:
    inset 1px 1px 0 rgba(200, 180, 140, 0.1),
    inset -1px -1px 0 rgba(0, 0, 0, 0.5),
    0 8px 24px rgba(0, 0, 0, 0.7);
  pointer-events: auto;
}

.game-container__world-shell::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 1px solid rgba(139, 115, 85, 0.15);
  pointer-events: none;
}

.game-container__stage-shell {
  position: relative;
  width: var(--map-display-width, 1120px);
  height: var(--map-display-height, 700px);
  max-width: none;
  aspect-ratio: auto;
  display: flex;
  align-items: stretch;
  justify-content: center;
  min-height: 0;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: #000;
  box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.8);
}

.game-container__stage-shell :deep(.game) {
  position: relative;
  width: 100%;
  height: 100%;
}

.game-container__stage-shell :deep(canvas) {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  outline: none;
}

.game-container__loading-screen {
  position: absolute;
  inset: 0;
  z-index: 78;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  background:
    radial-gradient(circle at 50% 48%, rgba(60, 45, 24, 0.32), transparent 24%),
    linear-gradient(180deg, rgba(5, 7, 8, 0.96), rgba(3, 5, 5, 0.99));
  color: rgba(197, 185, 158, 0.7);
  font-family: Georgia, serif;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  pointer-events: auto;
}

.game-container__loading-screen strong {
  color: #e6c675;
  font-family: 'GameFont', sans-serif;
  font-size: 0.86rem;
  font-weight: 400;
  letter-spacing: 0.1em;
  text-shadow: 0 2px 8px #000;
}

.game-container__loading-rune {
  color: #67c3ab;
  font-size: 2rem;
  line-height: 1;
  filter: drop-shadow(0 0 9px rgba(71, 193, 160, 0.52));
  animation: loading-rune-pulse 1.1s ease-in-out infinite alternate;
}

@keyframes loading-rune-pulse {
  from {
    opacity: 0.42;
    transform: scale(0.88) rotate(0deg);
  }

  to {
    opacity: 1;
    transform: scale(1.06) rotate(45deg);
  }
}

.game-container__hud {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 70;
  width: 100%;
  pointer-events: none;
}

.game-container__party-overlay {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 60;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  width: min(300px, 40%);
  pointer-events: auto;
}

.game-container__party-toggle {
  min-height: 29px;
  padding: 5px 12px;
  border-radius: 0;
  border: 1px solid var(--color-frame-dark);
  border-top-color: rgba(218, 184, 112, 0.35);
  background: var(--control-surface);
  color: var(--color-accent-strong);
  font: 0.67rem 'GameFont', sans-serif;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(183, 146, 79, 0.08), 0 3px 10px rgba(0, 0, 0, 0.38);
}

.game-container__party-toggle:hover,
.game-container__party-toggle:focus-visible {
  color: #fff0c2;
  border-color: var(--color-frame-light);
  background: var(--control-surface-hover);
  outline: none;
}

.game-container__pane-menu {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 3px;
  padding: 3px;
  background: rgba(5, 6, 7, 0.78);
  border: 1px solid rgba(120, 95, 54, 0.28);
  box-shadow: 0 5px 14px rgba(0, 0, 0, 0.42);
}

.game-container__world-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  padding: 3px;
  background: rgba(5, 6, 7, 0.66);
  border: 1px solid rgba(120, 95, 54, 0.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.34);
}

.game-container__party-overlay :deep(.party-panel) {
  width: 100%;
}

.game-container__zone-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
  min-width: 250px;
  padding: 10px;
  border-radius: 0;
  border: 1px solid var(--color-border-strong);
  outline: 1px solid #090806;
  outline-offset: -4px;
  background: var(--panel-surface);
  box-shadow: var(--shadow-strong);
}

.game-container__zone-title {
  margin: 0;
  font-size: 0.68rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-dim);
}

.game-container__zone-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 3px;
}

.game-container__zone-player-level {
  color: rgba(218, 190, 129, 0.82);
  font-size: 0.64rem;
  white-space: nowrap;
}

.game-container__zone {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
  padding: 7px 9px;
  border-radius: 0;
  border: 1px solid var(--color-frame-dark);
  background: var(--control-surface);
  color: var(--color-accent-strong);
  font-family: 'GameFont', sans-serif;
  cursor: pointer;

  &:hover {
    border-color: var(--color-accent-strong, #e0b45c);
    background: var(--control-surface-hover);
  }
}

.game-container__zone--recommended {
  border-color: rgba(207, 164, 83, 0.76);
  background:
    linear-gradient(90deg, rgba(111, 78, 30, 0.32), transparent 72%),
    var(--control-surface);
  box-shadow: inset 3px 0 0 #d6a94e;
}

.game-container__zone-status {
  color: #e7c570;
  font-size: 0.63rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.game-container__zone--danger {
  border-color: rgba(132, 55, 45, 0.56);
  background:
    linear-gradient(90deg, rgba(105, 28, 25, 0.25), transparent 70%),
    var(--control-surface);
}

.game-container__zone--danger .game-container__zone-status {
  color: #e7826f;
}

.game-container__zone--outlevelled {
  opacity: 0.68;
}

.game-container__zone-copy,
.game-container__zone-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.game-container__zone-copy {
  align-items: flex-start;
  min-width: 0;
  text-align: left;
}

.game-container__zone-meta {
  align-items: flex-end;
  flex: 0 0 auto;
}

.game-container__zone-name {
  font-size: 0.82rem;
}

.game-container__zone-note {
  color: rgba(178, 170, 153, 0.72);
  font-family: Georgia, serif;
  font-size: 0.64rem;
  white-space: nowrap;
}

.game-container__zone-level {
  font-size: 0.66rem;
  color: rgba(148, 180, 214, 0.86);
}

.game-container__chat-peek {
  position: absolute;
  left: var(--hud-chat-inset);
  bottom: calc(var(--hud-chat-inset) + var(--hud-chat-clearance));
  z-index: 66;
  display: inline-flex;
  align-items: center;
  gap: 0;
  max-width: min(340px, calc(100% - (var(--hud-chat-inset) * 2)));
  min-width: 172px;
  border: 1px solid rgba(180, 145, 86, 0.36);
  border-radius: var(--radius-sm);
  background: rgba(4, 5, 7, 0.78);
  color: #f2d391;
  font-size: 0.75rem;
  letter-spacing: 0;
  text-align: left;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.42);
  pointer-events: auto;
  overflow: hidden;
}

.game-container__chat-peek:hover {
  border-color: rgba(220, 185, 112, 0.62);
  background: rgba(10, 12, 15, 0.88);
}

.game-container__chat-peek-main {
  appearance: none;
  flex: 1 1 auto;
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
  padding: 7px 10px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: grab;
  touch-action: none;
}

.game-container__chat-peek-main:active {
  cursor: grabbing;
}

.game-container__chat-peek--dragging,
.game-container__chat-peek--dragging .game-container__chat-peek-main {
  cursor: grabbing;
}

.game-container__chat-peek-label {
  flex: 1 1 auto;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.game-container__chat-peek-count {
  flex: 0 0 auto;
  min-width: 18px;
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: #12100e;
  font-size: 0.7rem;
  font-weight: 700;
  text-align: center;
}

.game-container__chat-peek-move {
  appearance: none;
  flex: 0 0 42px;
  align-self: stretch;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-left: 1px solid rgba(180, 145, 86, 0.26);
  background: rgba(0, 0, 0, 0.26);
  cursor: grab;
  touch-action: none;
}

.game-container__chat-peek-move:hover {
  background: rgba(197, 160, 89, 0.14);
}

.game-container__chat-peek-move:active {
  cursor: grabbing;
}

.game-container__chat-peek-main:focus-visible,
.game-container__chat-peek-move:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: -2px;
}

.game-container__chat-peek-move span {
  display: block;
  width: 18px;
  height: 12px;
  background-image: radial-gradient(circle, rgba(242, 211, 145, 0.76) 1px, transparent 1.5px);
  background-size: 6px 6px;
  background-position: center;
}

.game-container__chat-overlay {
  position: absolute;
  left: var(--hud-chat-inset);
  bottom: calc(var(--hud-chat-inset) + var(--hud-chat-clearance));
  width: min(320px, calc(100% - (var(--hud-chat-inset) * 2)));
  min-width: min(260px, calc(100% - (var(--hud-chat-inset) * 2)));
  z-index: 65;
  pointer-events: auto;
}

.game-container__chat-overlay--collapsed {
  opacity: 0;
  transform: translateY(8px);
  pointer-events: none;
}

.game-container__chat-drag-handle {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  border: 1px solid rgba(180, 145, 86, 0.3);
  border-bottom: 0;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  background: rgba(4, 5, 7, 0.68);
  cursor: grab;
  touch-action: none;
}

.game-container__chat-drag-handle--dragging {
  cursor: grabbing;
}

.game-container__chat-drag-handle:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.game-container__chat-grip {
  width: 48px;
  height: 16px;
  background-image: radial-gradient(circle, rgba(242, 211, 145, 0.7) 1px, transparent 1.5px);
  background-size: 7px 6px;
  background-position: center;
  opacity: 0.76;
}

.game-container__chat-dock-cycle {
  position: absolute;
  top: 2px;
  right: 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 18px;
  padding: 0;
  border: 1px solid rgba(180, 145, 86, 0.24);
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.42);
  cursor: pointer;
}

.game-container__chat-dock-cycle span {
  display: block;
  width: 7px;
  height: 7px;
  border-top: 1px solid #f2d391;
  border-right: 1px solid #f2d391;
  transform: rotate(45deg);
}

.game-container__chat-dock-cycle:hover {
  border-color: rgba(220, 185, 112, 0.62);
  background: rgba(10, 12, 15, 0.72);
}

.game-container__chat-dock-cycle:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.game-container__chat-overlay :deep(.chatbox) {
  --chat-width: 100%;

  background:
    linear-gradient(90deg, rgba(91, 26, 29, 0.08), transparent 46%, rgba(35, 65, 84, 0.08)),
    rgba(6, 7, 8, 0.9);
  border-color: rgba(183, 146, 79, 0.38);
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.48), inset 0 0 22px rgba(0, 0, 0, 0.38);
  backdrop-filter: blur(3px);
}

.game-container__chat-overlay :deep(.chatbox__header) {
  background: rgba(14, 12, 10, 0.78);
}

.game-container__chat-overlay :deep(.chatbox__messages) {
  background: transparent;
  max-height: min(210px, 34vh);
  padding: 8px 10px;
}

.game-container--ui-hidden :deep(.pane-host__side),
.game-container--ui-hidden :deep(.pane-host__overlay),
.game-container--ui-hidden .game-container__chat-peek,
.game-container--ui-hidden .game-container__chat-overlay,
.game-container--ui-hidden .game-container__hud {
  opacity: 0;
  pointer-events: none;
}

@media (width <= 639px) {
  .game-container {
    --arpg-pane-width: calc(100vw - 12px);
    --arpg-center-left: 6px;
    --arpg-center-right: 6px;
    --arpg-stage-top: 6px;
    --arpg-stage-bottom: 6px;
    --hud-orb-size: clamp(96px, 20vw, 118px);
    --hud-chat-clearance: 0px;
  }

  .game-container--left-pane-open,
  .game-container--right-pane-open {
    --arpg-center-left: 6px;
    --arpg-center-right: 6px;
  }

  .game-container__center {
    gap: var(--space-sm);
  }

  .game-container__chat-overlay {
    left: 8px;
    right: 8px;
    bottom: var(--hud-chat-inset);
    width: auto;
    min-width: 0;
  }

  .game-container__chat-peek {
    left: 8px;
    right: 8px;
    bottom: var(--hud-chat-inset);
    max-width: none;
    min-width: 0;
  }
}

@media (width > 639px) and (width <= 1100px) {
  .game-container {
    --hud-orb-size: clamp(112px, 12vw, 136px);
  }
}
</style>
