<template>
  <div
    class="wrapper game-container"
    :class="gameContainerClasses"
    @click.right.prevent="handleRightClick"
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
      @overlay-close="$emit('overlay-close')"
    >
      <div class="game-container__center">
        <div
          class="game-container__world-shell"
          :style="worldShellStyle"
        >
          <div class="game-container__stage-shell" @click.self="refocusGame">
            <GameCanvas ref="canvasRef" :game="game" />
            <div
              ref="floatingLayerRef"
      class="game-container__floating-layer"
      v-if="!uiHidden"
    >
              <FloatingWindow
                title="Inventory"
                :open="floatingPanels.inventory.open"
                :dock="viewMode === 'inventory' ? 'right' : floatingPanels.inventory.dock"
                :position="inventoryPosition"
                :width="viewMode === 'inventory' ? '520px' : floatingPanels.inventory.width"
                :height="viewMode === 'inventory' ? '72vh' : floatingPanels.inventory.height"
                :z-index="floatingPanels.inventory.zIndex"
                :bounds="floatingBounds"
                :enable-double-click-dock="false"
                :allow-ghost-toggle="true"
                @update:position="updatePanelPosition('inventory', $event)"
                @update:dock="updatePanelDock('inventory', $event)"
                @close="closePanel('inventory')"
                @focus="focusPanel('inventory')"
              >
                <InventoryPane :game="game" />
              </FloatingWindow>

              <FloatingWindow
                v-if="playerId"
                title="Party"
                :open="!uiHidden && floatingPanels.party.open"
                :dock="floatingPanels.party.dock"
                :position="floatingPanels.party.position"
                :width="floatingPanels.party.width"
                :z-index="floatingPanels.party.zIndex"
                :bounds="floatingBounds"
                :enable-double-click-dock="false"
                :allow-ghost-toggle="true"
                @update:position="updatePanelPosition('party', $event)"
                @update:dock="updatePanelDock('party', $event)"
                @close="closePanel('party')"
                @focus="focusPanel('party')"
              >
                <PartyPanel
                  class="game-container__party-panel"
                  :player-id="playerId"
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
              </FloatingWindow>

              <FloatingWindow
                title="Chat"
                :open="!uiHidden && floatingPanels.chat.open"
                :dock="floatingPanels.chat.dock"
                :position="floatingPanels.chat.position"
                :width="floatingPanels.chat.width"
                :z-index="floatingPanels.chat.zIndex"
                :bounds="floatingBounds"
                :enable-double-click-dock="false"
                :allow-ghost-toggle="true"
                @update:position="updatePanelPosition('chat', $event)"
                @update:dock="updatePanelDock('chat', $event)"
                @close="closePanel('chat')"
                @focus="focusPanel('chat')"
              >
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
              </FloatingWindow>
            </div>
          </div>
          <div
            v-if="!uiHidden"
            class="game-container__floating-controls"
          >
            <button
              type="button"
              class="floating-controls__btn"
              :class="{ 'floating-controls__btn--active': floatingPanels.inventory.open }"
              @click="togglePanel('inventory')"
            >
              Inventory
            </button>
            <button
              type="button"
              class="floating-controls__btn"
              :class="{ 'floating-controls__btn--active': floatingPanels.party.open }"
              @click="togglePanel('party')"
            >
              Party
            </button>
            <button
              type="button"
              class="floating-controls__btn"
              :class="{ 'floating-controls__btn--active': floatingPanels.chat.open }"
              @click="handleChatControl"
            >
              Chat
              <span
                v-if="chatUnreadCount > 0"
                class="floating-controls__badge"
              >{{ chatUnreadCount }}</span>
            </button>
            <button
              type="button"
              class="floating-controls__btn floating-controls__btn--ghost"
              @click="resetPanels"
            >
              Reset Layout
            </button>
            <button
              type="button"
              class="floating-controls__btn floating-controls__btn--ghost"
              @click="hardResetUI"
            >
              Hard Reset UI
            </button>
            <button
              type="button"
              class="floating-controls__btn floating-controls__btn--ghost"
              :class="{ 'floating-controls__btn--active': viewMode === 'inventory' }"
              @click="toggleViewMode"
            >
              Inventory Mode
            </button>
            <button
              type="button"
              class="floating-controls__btn floating-controls__btn--ghost"
              :class="{ 'floating-controls__btn--active': uiHidden }"
              @click="toggleUiHidden"
            >
              Hide UI
            </button>
          </div>
          <GameHUD
            class="game-container__hud"
            :player-vitals="playerVitals"
            :quick-slots="quickSlots"
            :quickbar-active-index="quickbarActiveIndex"
            @quick-slot="handleQuickSlot"
            @request-remap="handleQuickbarRemap"
          />
        </div>
      </div>
    </PaneHost>

    <ContextMenu :game="game" />

    <button
      v-if="uiHidden"
      class="game-container__show-ui"
      type="button"
      @click="toggleUiHidden"
    >
      Show UI
    </button>
  </div>
</template>

<script>
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  toRefs,
  watch,
} from 'vue';
import PaneHost from '../ui/panes/PaneHost.vue';
import GameCanvas from '../GameCanvas.vue';
import Chatbox from '../Chatbox.vue';
import ContextMenu from '../sub/ContextMenu.vue';
import GameHUD from './GameHUD.vue';
import PartyPanel from '../ui/world/PartyPanel.vue';
import FloatingWindow from '../ui/panes/FloatingWindow.vue';
import InventoryPane from '../slots/Inventory.vue';

export default {
  name: 'GameContainer',
  components: {
    PaneHost,
    GameCanvas,
    Chatbox,
    ContextMenu,
    GameHUD,
    PartyPanel,
    FloatingWindow,
    InventoryPane,
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
    playerVitals: {
      type: Object,
      required: true,
    },
    quickSlots: {
      type: Array,
      default: () => [],
    },
    quickbarActiveIndex: {
      type: Number,
      default: null,
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
    'toggle-chat',
    'toggle-chat-pin',
    'chat-hover',
    'chat-countdown-complete',
    'chat-message',
  ],
  setup(props, { emit, expose }) {
    const paneHostRef = ref(null);
    const chatboxRef = ref(null);
    const canvasRef = ref(null);
    const { game } = toRefs(props);

    const playerId = computed(() => (game.value && game.value.player ? game.value.player.uuid : null));

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

    const floatingPanels = reactive({
      inventory: {
        open: true,
        dock: 'right',
        position: { x: 24, y: 80 },
        width: '500px',
        height: '58vh',
        zIndex: 52,
      },
      party: {
        open: true,
        dock: 'left',
        position: { x: 24, y: 20 },
        width: '340px',
        zIndex: 51,
      },
      chat: {
        open: true,
        dock: 'right',
        position: { x: 24, y: 520 },
        width: '400px',
        zIndex: 53,
      },
    });

    const defaultFloatingPanels = JSON.parse(JSON.stringify(floatingPanels));
    const STORAGE_KEY = 'delaford:floating-panels';
    const viewMode = ref('default');
    const uiHidden = ref(false);

    const floatingLayerRef = ref(null);
    const floatingBounds = ref({
      left: 0,
      top: 0,
      width: 0,
      height: 0,
    });
    const zCounter = ref(60);

    const clampPositionToBounds = (position = {}) => {
      const bounds = floatingBounds.value || {};
      const allowance = 240;
      const { x = 0, y = 0 } = position;
      const maxX = Math.max(0, (bounds.width || 0) - 220);
      const maxY = Math.max(0, (bounds.height || 0) - 200);
      return {
        x: Math.min(Math.max(-allowance, x), (maxX || x) + allowance),
        y: Math.min(Math.max(-allowance, y), (maxY || y) + allowance),
      };
    };

    const updateFloatingBounds = () => {
      const el = floatingLayerRef.value;
      if (!el) {
        floatingBounds.value = {
          left: 0,
          top: 0,
          width: window.innerWidth || 0,
          height: window.innerHeight || 0,
        };
        return;
      }
      const rect = el.getBoundingClientRect();
      floatingBounds.value = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    };

    const focusPanel = (key) => {
      if (!floatingPanels[key]) {
        return;
      }
      zCounter.value += 1;
      floatingPanels[key].zIndex = zCounter.value;
    };

    const updatePanelPosition = (key, position) => {
      if (!floatingPanels[key]) {
        return;
      }
      if (key === 'inventory' && viewMode.value === 'inventory') {
        viewMode.value = 'default';
      }
      floatingPanels[key].position = clampPositionToBounds(position);
      floatingPanels[key].dock = 'floating';
      focusPanel(key);
    };

    const updatePanelDock = (key, dock) => {
      if (!floatingPanels[key]) {
        return;
      }
      floatingPanels[key].dock = dock;
      focusPanel(key);
    };

    const closePanel = (key) => {
      if (!floatingPanels[key]) {
        return;
      }
      floatingPanels[key].open = false;
    };

    const togglePanel = (key) => {
      if (!floatingPanels[key]) {
        return;
      }
      floatingPanels[key].open = !floatingPanels[key].open;
      if (floatingPanels[key].open) {
        focusPanel(key);
      }
    };

    const resetPanels = () => {
      Object.keys(defaultFloatingPanels).forEach((key) => {
        floatingPanels[key] = JSON.parse(JSON.stringify(defaultFloatingPanels[key]));
      });
      zCounter.value = 60;
      viewMode.value = 'default';
      uiHidden.value = false;
    };

    const hardResetUI = () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
      resetPanels();
    };

    const loadSavedPanels = () => {
      if (typeof window === 'undefined') {
        return;
      }
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) {
          return;
        }
        const parsed = JSON.parse(saved);
        Object.keys(floatingPanels).forEach((key) => {
          if (parsed[key]) {
            floatingPanels[key] = {
              ...floatingPanels[key],
              ...parsed[key],
              position: clampPositionToBounds(parsed[key].position || floatingPanels[key].position),
            };
          }
        });
        if (parsed.viewMode) {
          viewMode.value = parsed.viewMode;
        }
        if (typeof parsed.uiHidden === 'boolean') {
          uiHidden.value = parsed.uiHidden;
        }
      } catch (error) {
        console.error('Failed to load floating panels layout', error);
      }
    };

    const persistPanels = () => {
      if (typeof window === 'undefined') {
        return;
      }
      const snapshot = JSON.parse(JSON.stringify(floatingPanels));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          ...snapshot,
          viewMode: viewMode.value,
          uiHidden: uiHidden.value,
        }));
      } catch (error) {
        console.error('Failed to save floating panels layout', error);
      }
    };

    const handleChatControl = () => {
      const wasOpen = floatingPanels.chat.open;
      togglePanel('chat');
      if (!wasOpen && !props.chatExpanded) {
        emit('toggle-chat');
      }
    };

    const toggleViewMode = () => {
      viewMode.value = viewMode.value === 'inventory' ? 'default' : 'inventory';
    };

    const toggleUiHidden = () => {
      uiHidden.value = !uiHidden.value;
    };

    onMounted(() => {
      updateFloatingBounds();
      window.addEventListener('resize', updateFloatingBounds);
      loadSavedPanels();
    });

    onBeforeUnmount(() => {
      window.removeEventListener('resize', updateFloatingBounds);
    });

    watch(() => props.layoutMode, () => {
      updateFloatingBounds();
    });

    watch(floatingPanels, persistPanels, { deep: true });
    watch(viewMode, persistPanels);
    watch(uiHidden, persistPanels);

    expose({ paneHostRef, chatboxRef, canvasRef, triggerSkill, refocusGame });

    return {
      paneHostRef,
      chatboxRef,
      canvasRef,
      playerId,
      floatingPanels,
      floatingBounds,
      floatingLayerRef,
      handleRightClick,
      handleQuickSlot,
      handleQuickbarRemap,
      triggerSkill,
      updatePanelPosition,
      updatePanelDock,
      closePanel,
      togglePanel,
      focusPanel,
      handleChatControl,
      toggleViewMode,
      toggleUiHidden,
      hardResetUI,
      viewMode,
      uiHidden,
      refocusGame,
      gameContainerClasses: computed(() => ({
        'game-container--inventory-mode': viewMode.value === 'inventory',
        'game-container--ui-hidden': uiHidden.value,
      })),
      inventoryPosition: computed(() => {
        if (viewMode.value === 'inventory' && floatingPanels.inventory.dock !== 'floating') {
          const bounds = floatingBounds.value || {};
          const width = 520;
          const x = Math.max(-40, (bounds.width || window.innerWidth || 1280) - width - 32);
          return { x, y: 24 };
        }
        return floatingPanels.inventory.position;
      }),
    };
  },
};
</script>

<style scoped lang="scss">
@use '@/assets/scss/abstracts/tokens' as *;

.game-container {
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
  overflow: auto;
}

.game-container__stage {
  display: flex;
  flex: 1 1 auto;
}

.game-container__center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  min-height: 0;
  position: relative;
  gap: var(--space-sm);
}

.game-container__world-shell {
  position: relative;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto auto;
  padding: 4px;
  gap: var(--space-xs);
  width: 100%;
  max-width: 100%;
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
  width: 100%;
  max-width: none;
  aspect-ratio: var(--map-aspect-ratio, 16 / 9);
  display: flex;
  align-items: stretch;
  justify-content: center;
  min-height: 0;
  border-radius: var(--radius-sm);
  overflow: visible;
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
  width: 100%;
}

.game-container__floating-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 8;
}

.game-container__floating-layer :deep(.floating-window) {
  pointer-events: auto;
}

.game-container__floating-controls {
  position: fixed;
  right: var(--space-sm);
  bottom: var(--space-sm);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-radius: var(--radius-md);
  background: linear-gradient(180deg, #3a3228 0%, #28221a 100%);
  border: 2px solid var(--color-frame-dark);
  border-top-color: var(--color-bevel-light);
  border-left-color: var(--color-bevel-light);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
  z-index: 150;
  flex-wrap: wrap;
}

.floating-controls__btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-frame-dark);
  background: linear-gradient(180deg, #4a4030 0%, #2a2418 100%);
  color: var(--color-text-primary);
  font-family: 'GameFont', sans-serif;
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.floating-controls__btn:hover {
  background: linear-gradient(180deg, #4a3e2a 0%, #2a2218 100%);
  border-color: var(--color-frame);
}

.floating-controls__btn--active {
  background: linear-gradient(180deg, #4a3a20 0%, #2a2010 100%);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.floating-controls__btn--ghost {
  color: var(--color-text-secondary);
  font-size: clamp(10px, 0.9vw, 12px);
}

.floating-controls__badge {
  min-width: 16px;
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: #12100e;
  font-weight: 700;
  font-size: 0.7em;
}

.game-container--inventory-mode .game-container__floating-controls {
  justify-content: flex-end;
}

.game-container--ui-hidden :deep(.pane-host__side),
.game-container--ui-hidden :deep(.pane-host__overlay),
.game-container--ui-hidden .game-container__floating-layer,
.game-container--ui-hidden .game-container__floating-controls,
.game-container--ui-hidden .game-container__hud {
  opacity: 0;
  pointer-events: none;
}

.game-container__show-ui {
  position: fixed;
  right: var(--space-md);
  bottom: var(--space-md);
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 2px solid var(--color-frame-dark);
  border-top-color: var(--color-bevel-light);
  border-left-color: var(--color-bevel-light);
  background: linear-gradient(180deg, #4a4030 0%, #2a2418 100%);
  color: var(--color-text-primary);
  font-family: 'GameFont', sans-serif;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  z-index: 200;
}

.game-container__party-panel {
  min-width: 240px;
}

@media (width <= 639px) {
  .game-container__center {
    gap: var(--space-sm);
  }

  .game-container__floating-layer {
    inset: 2px;
  }

  .floating-controls__btn {
    padding: 4px 8px;
    font-size: clamp(10px, 0.9vw, 12px);
  }
}
</style>
