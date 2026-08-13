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
            />
            <WorldMinimap
              v-if="!uiHidden"
              :game="game"
            />
            <div
              v-if="!uiHidden"
              class="game-container__party-overlay"
            >
              <button
                type="button"
                class="game-container__party-toggle"
                @click="partyOpen = !partyOpen"
              >
                Party{{ partyInvites.length ? ` (${partyInvites.length})` : '' }}
              </button>
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
              <button
                type="button"
                class="game-container__party-toggle"
                @click="adventureOpen = !adventureOpen"
              >
                Adventure
              </button>
              <button
                type="button"
                class="game-container__party-toggle"
                title="Quest journal (Q)"
                @click="$emit('request-pane', 'quests')"
              >
                Quests
              </button>
              <div
                v-if="adventureOpen"
                class="game-container__zone-menu"
                aria-label="Choose a zone"
              >
                <p class="game-container__zone-title">Descend into…</p>
                <button
                  v-for="zone in adventureZones"
                  :key="zone.id"
                  type="button"
                  class="game-container__zone"
                  @click="enterZone(zone)"
                >
                  <span class="game-container__zone-name">{{ zone.name }}</span>
                  <span class="game-container__zone-level">Lv {{ zone.levelHint }}</span>
                </button>
              </div>
            </div>
            <div
              v-if="!uiHidden && !chatExpanded"
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
              v-if="!uiHidden"
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
            @request-remap="handleQuickbarRemap"
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
    'request-remap',
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

    const handleQuickbarRemap = (slot, index) => {
      emit('request-remap', slot, index);
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

    const uiHidden = ref(false);
    const partyOpen = ref(false);
    const adventureOpen = ref(false);

    // Zone menu must match the server's ADVENTURE_ZONES; each zone pairs an art
    // template with a layout shape (warren/clearings/gauntlet). The server
    // validates both and falls back to sensible defaults if unknown.
    const adventureZones = [
      { id: 'old-barrow', name: 'The Old Barrow', template: 'dungeon', layout: 'warren', levelHint: '1–5' },
      { id: 'verdant-grove', name: 'Verdant Grove', template: 'grove', layout: 'clearings', levelHint: '1–6' },
      { id: 'sunken-colonnade', name: 'Sunken Colonnade', template: 'crypt', layout: 'gauntlet', levelHint: '3–8' },
      { id: 'weir-crypt', name: 'Weir Crypt', template: 'crypt', layout: 'warren', levelHint: '4–9' },
      { id: 'the-wilds', name: 'The Wilds', template: 'wilds', layout: 'clearings', levelHint: '6–12' },
      { id: 'marsh-of-reeds', name: 'Marsh of Reeds', template: 'marsh', layout: 'clearings', levelHint: '8–14' },
    ];

    const enterZone = (zone) => {
      adventureOpen.value = false;
      emit('enter-zone', { template: zone.template, layout: zone.layout });
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

    expose({ paneHostRef, chatboxRef, canvasRef, triggerSkill, refocusGame });

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
      handleQuickbarRemap,
      triggerSkill,
      uiHidden,
      partyOpen,
      adventureOpen,
      adventureZones,
      enterZone,
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
  gap: var(--space-xs);
  width: min(300px, 40%);
  pointer-events: auto;
}

.game-container__party-toggle {
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(180, 145, 86, 0.4);
  background: rgba(12, 16, 28, 0.85);
  color: #f5d68a;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
}

.game-container__party-toggle:hover {
  background: rgba(40, 36, 28, 0.95);
}

.game-container__party-overlay :deep(.party-panel) {
  width: 100%;
}

.game-container__zone-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
  padding: 8px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(180, 145, 86, 0.4);
  background: rgba(10, 12, 20, 0.94);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.55);
}

.game-container__zone-title {
  margin: 0 0 2px;
  font-size: 0.68rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(231, 218, 190, 0.7);
}

.game-container__zone {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(180, 145, 86, 0.28);
  background: linear-gradient(180deg, rgba(58, 30, 26, 0.85), rgba(24, 14, 12, 0.9));
  color: #f2d391;
  font-family: 'GameFont', sans-serif;
  cursor: pointer;

  &:hover {
    border-color: var(--color-accent-strong, #e0b45c);
    background: linear-gradient(180deg, rgba(78, 40, 34, 0.9), rgba(34, 20, 16, 0.95));
  }
}

.game-container__zone-name {
  font-size: 0.82rem;
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

  background: rgba(4, 5, 7, 0.34);
  border-color: rgba(180, 145, 86, 0.16);
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  box-shadow: none;
  backdrop-filter: blur(1px);
}

.game-container__chat-overlay :deep(.chatbox__header) {
  background: rgba(4, 5, 7, 0.28);
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
