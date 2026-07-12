<template>
  <div
    class="pane-host"
    :class="[
      `pane-host--${layoutMode}`,
      { 'pane-host--no-left': !showLeftPane, 'pane-host--no-right': !showRightPane },
    ]"
  >
    <transition
      name="pane-slide"
      appear
    >
      <aside
        v-if="showLeftPane"
        key="left"
        class="pane-host__side pane-host__side--left"
      >
        <PaneCard
          :title="leftPaneTitle"
          :aria-label="`${leftPaneTitle} panel`"
          :compressed="layoutMode !== 'desktop'"
          :dismissible="true"
          @dismiss="$emit('overlay-close', leftPane)"
        >
          <component
            :is="leftPaneComponent"
            v-if="leftPaneComponent"
            :game="game"
          />
        </PaneCard>
      </aside>
    </transition>

    <div class="pane-host__center">
      <slot />
    </div>

    <transition
      name="pane-slide"
      appear
    >
      <aside
        v-if="showRightPane"
        key="right"
        class="pane-host__side pane-host__side--right"
      >
        <PaneCard
          :title="rightPaneTitle"
          :aria-label="`${rightPaneTitle} panel`"
          :compressed="layoutMode !== 'desktop'"
          :dismissible="true"
          @dismiss="$emit('overlay-close', rightPane)"
        >
          <component
            :is="rightPaneComponent"
            v-if="rightPaneComponent"
            :game="game"
          />
        </PaneCard>
      </aside>
    </transition>

    <transition name="pane-overlay">
      <div
        v-if="showOverlay"
        class="pane-host__overlay"
        :class="overlayClasses"
        role="dialog"
        aria-modal="true"
        @click.self="$emit('overlay-close')"
      >
        <PaneCard
          ref="overlayCard"
          :class="overlayCardClasses"
          :title="overlayTitle"
          :dismissible="true"
          :aria-label="`${overlayTitle} overlay`"
          @dismiss="$emit('overlay-close')"
        >
          <component
            :is="overlayComponent"
            v-if="overlayComponent"
            :game="game"
            v-bind="overlayPane && overlayPane.props ? overlayPane.props : {}"
            @resume="$emit('overlay-close')"
            @open-pane="$emit('request-pane', $event)"
          />
        </PaneCard>
      </div>
    </transition>
  </div>
</template>

<script>
import PaneCard from './PaneCard.vue';

export default {
  name: 'PaneHost',
  components: {
    PaneCard,
  },
  props: {
    layoutMode: {
      type: String,
      default: 'desktop',
    },
    game: {
      type: Object,
      required: true,
    },
    registry: {
      type: Object,
      default: () => ({}),
    },
    leftPane: {
      type: String,
      default: null,
    },
    rightPane: {
      type: String,
      default: null,
    },
    overlayPane: {
      type: Object,
      default: () => ({ id: null, title: '', props: {} }),
    },
  },
  emits: ['overlay-close', 'request-pane'],
  computed: {
    paneRegistry() {
      return this.registry || {};
    },
    leftPaneEntry() {
      if (!this.leftPane) {
        return null;
      }
      return this.paneRegistry[this.leftPane] || null;
    },
    rightPaneEntry() {
      if (!this.rightPane) {
        return null;
      }
      return this.paneRegistry[this.rightPane] || null;
    },
    overlayPaneEntry() {
      if (!this.overlayPane || !this.overlayPane.id) {
        return null;
      }
      return this.paneRegistry[this.overlayPane.id] || null;
    },
    leftPaneComponent() {
      return this.leftPaneEntry && this.leftPaneEntry.component;
    },
    rightPaneComponent() {
      return this.rightPaneEntry && this.rightPaneEntry.component;
    },
    overlayComponent() {
      return this.overlayPaneEntry && this.overlayPaneEntry.component;
    },
    leftPaneTitle() {
      if (!this.leftPaneEntry) {
        return '';
      }
      return this.leftPaneEntry.title || this.capitalise(this.leftPane);
    },
    rightPaneTitle() {
      if (!this.rightPaneEntry) {
        return '';
      }
      return this.rightPaneEntry.title || this.capitalise(this.rightPane);
    },
    overlayTitle() {
      if (!this.overlayPaneEntry) {
        return '';
      }
      if (this.overlayPane && this.overlayPane.title) {
        return this.overlayPane.title;
      }
      return this.overlayPaneEntry.title || this.capitalise(this.overlayPane.id);
    },
    overlayOptions() {
      const entryOptions = (this.overlayPaneEntry && this.overlayPaneEntry.options) || {};
      const paneOptions = (this.overlayPane && this.overlayPane.options) || {};
      return { fullscreen: false, ...entryOptions, ...paneOptions };
    },
    overlayClasses() {
      return {
        'pane-host__overlay--fullscreen': this.overlayOptions.fullscreen,
        [`pane-host__overlay--${this.overlayPane?.id || 'none'}`]: true,
      };
    },
    overlayCardClasses() {
      const compact = ['logout', 'settings', 'quests'].includes(this.overlayPane?.id);
      return {
        'pane-host__overlay-card': true,
        'pane-host__overlay-card--fullscreen': this.overlayOptions.fullscreen,
        'pane-host__overlay-card--compact': compact,
      };
    },
    showLeftPane() {
      if (!this.leftPaneComponent) {
        return false;
      }
      return true;
    },
    showRightPane() {
      if (!this.rightPaneComponent) {
        return false;
      }
      return true;
    },
    showOverlay() {
      if (!this.overlayComponent) {
        return false;
      }
      if (this.layoutMode === 'desktop' && this.overlayPane && (this.overlayPane.id === this.leftPane || this.overlayPane.id === this.rightPane)) {
        return false;
      }
      return true;
    },
  },
  methods: {
    capitalise(value) {
      if (typeof value !== 'string') {
        return '';
      }
      return value.charAt(0).toUpperCase() + value.slice(1);
    },
  },
};
</script>

<style lang="scss" scoped>
@use '@/assets/scss/abstracts/tokens' as *;

.pane-host {
  --pane-host-panel-top: 8px;
  --pane-host-panel-bottom: 104px;
  --pane-host-panel-gutter: 8px;
  --pane-host-side-width: var(--arpg-pane-width, clamp(420px, 28vw, 560px));

  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  width: 100%;
  height: 100%;
  align-items: stretch;
}

.pane-host__side {
  position: fixed;
  top: var(--pane-host-panel-top);
  bottom: var(--pane-host-panel-bottom);
  z-index: 70;
  display: flex;
  flex-direction: column;
  width: var(--pane-host-side-width);
  min-width: min(360px, calc(100vw - 16px));
  max-width: var(--pane-host-side-width);
  pointer-events: auto;

  &--left {
    align-items: stretch;
    left: var(--pane-host-panel-gutter);
  }

  &--right {
    align-items: stretch;
    right: var(--pane-host-panel-gutter);
  }
}

.pane-host__side :deep(.pane-card) {
  height: 100%;
}

.pane-host__side :deep(.pane-card__body) {
  flex: 1 1 auto;
  min-height: 0;
  max-height: none;
}

.pane-host__center {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 0;
  gap: var(--space-sm);
  width: 100%;
}

.pane-host__overlay {
  position: fixed;
  inset: var(--pane-host-panel-top) var(--pane-host-panel-gutter) var(--pane-host-panel-bottom);
  background:
    radial-gradient(circle at 20% 10%, rgba(91, 26, 29, 0.2), transparent 34%),
    radial-gradient(circle at 80% 10%, rgba(35, 65, 84, 0.16), transparent 31%),
    rgba(4, 5, 6, 0.91);
  display: grid;
  align-items: center;
  justify-items: center;
  padding: 0;
  z-index: 50;
}

.pane-host__overlay-card {
  max-width: min(760px, calc(100vw - 32px));
  width: 100%;
}

.pane-host__overlay-card--compact {
  max-width: min(560px, calc(100vw - 32px));
}

.pane-host__overlay-card--compact :deep(.pane-card__body) {
  max-height: min(68vh, 520px);
  overflow: auto;
}

.pane-host__overlay--fullscreen {
  padding: 0;
}

.pane-host__overlay-card--fullscreen {
  max-width: none;
  width: 100%;
  height: 100%;
}

.pane-host__overlay-card--fullscreen :deep(.pane-card) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.pane-host__overlay-card--fullscreen :deep(.pane-card__body) {
  flex: 1 1 auto;
  min-height: 0;
  max-height: none;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: clamp(var(--space-md), 1vw, var(--space-lg));
  padding: clamp(var(--space-lg), 2vw, var(--space-xl));
}

.pane-host__overlay-card--fullscreen :deep(.pane-card__body > *) {
  flex: 1 1 auto;
  min-height: 0;
}

.pane-host--tablet {
  --pane-host-side-width: min(44vw, 520px);
}

.pane-host--mobile {
  --pane-host-panel-top: 6px;
  --pane-host-panel-bottom: 92px;
  --pane-host-panel-gutter: 6px;
  --pane-host-side-width: calc(100vw - 12px);
}

.pane-host--mobile .pane-host__side {
  left: var(--pane-host-panel-gutter);
  right: var(--pane-host-panel-gutter);
  width: auto;
  max-width: none;
}

.pane-slide-enter-active,
.pane-slide-leave-active {
  transition: opacity 180ms ease-out, transform 180ms ease-out;
}

.pane-slide-enter-from,
.pane-slide-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

.pane-overlay-enter-active,
.pane-overlay-leave-active {
  transition: opacity 200ms ease-out;
}

.pane-overlay-enter-from,
.pane-overlay-leave-to {
  opacity: 0;
}
</style>
