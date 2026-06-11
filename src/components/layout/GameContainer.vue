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
            <GameCanvas
              ref="canvasRef"
              :game="game"
              :world-viewport="worldViewport"
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
            </div>
            <div
              v-if="!uiHidden && chatExpanded"
              class="game-container__chat-overlay"
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
            </div>
          </div>
          <GameHUD
            class="game-container__hud"
            :player-vitals="playerVitals"
            :player-progress="playerProgress"
            :quick-slots="quickSlots"
            :quickbar-active-index="quickbarActiveIndex"
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
  ref,
} from 'vue';
import PaneHost from '../ui/panes/PaneHost.vue';
import GameCanvas from '../GameCanvas.vue';
import Chatbox from '../Chatbox.vue';
import ContextMenu from '../sub/ContextMenu.vue';
import PartyPanel from '../ui/world/PartyPanel.vue';
import GameHUD from './GameHUD.vue';

export default {
  name: 'GameContainer',
  components: {
    PaneHost,
    GameCanvas,
    Chatbox,
    ContextMenu,
    PartyPanel,
    GameHUD,
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

    expose({ paneHostRef, chatboxRef, canvasRef, triggerSkill, refocusGame });

    return {
      paneHostRef,
      chatboxRef,
      canvasRef,
      handleRightClick,
      handleQuickSlot,
      handleQuickbarRemap,
      triggerSkill,
      uiHidden,
      partyOpen,
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
  grid-template-rows: minmax(0, 1fr) auto;
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
  width: 100%;
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

.game-container__chat-overlay {
  position: fixed;
  left: calc(var(--arpg-pane-gutter) + 6px);
  bottom: 112px;
  width: min(430px, calc(50vw - 28px));
  min-width: 320px;
  z-index: 65;
  pointer-events: auto;
}

.game-container__chat-overlay :deep(.chatbox) {
  --chat-width: 100%;

  background: rgba(4, 5, 7, 0.34);
  border-color: rgba(180, 145, 86, 0.16);
  box-shadow: none;
  backdrop-filter: blur(1px);
}

.game-container__chat-overlay :deep(.chatbox__header) {
  background: rgba(4, 5, 7, 0.28);
}

.game-container__chat-overlay :deep(.chatbox__messages) {
  background: transparent;
  max-height: 280px;
}

.game-container--ui-hidden :deep(.pane-host__side),
.game-container--ui-hidden :deep(.pane-host__overlay),
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
    bottom: 96px;
    width: auto;
    min-width: 0;
  }
}
</style>
