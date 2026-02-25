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
  emits: ['overlay-close'],
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
      };
    },
    overlayCardClasses() {
      return {
        'pane-host__overlay-card': true,
        'pane-host__overlay-card--fullscreen': this.overlayOptions.fullscreen,
      };
    },
    showLeftPane() {
      if (!this.leftPaneComponent) {
        return false;
      }
      return this.layoutMode !== 'mobile';
    },
    showRightPane() {
      if (!this.rightPaneComponent) {
        return false;
      }
      return this.layoutMode !== 'mobile';
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
  --pane-host-side-width: clamp(200px, 18vw, 280px);

  position: relative;
  display: grid;
  grid-template-columns: minmax(0, var(--pane-host-side-width)) minmax(0, 1fr) minmax(0, var(--pane-host-side-width));
  gap: var(--space-xs);
  width: 100%;
  height: 100%;
  align-items: stretch;
  transition: grid-template-columns 160ms ease-out, gap 160ms ease-out;

  &--tablet {
    grid-template-columns: minmax(0, var(--pane-host-side-width)) minmax(0, 1fr);
  }

  &--mobile {
    grid-template-columns: minmax(0, 1fr);
  }

  &--no-left {
    grid-template-columns: minmax(0, 1fr) minmax(0, var(--pane-host-side-width));
  }

  &--no-right {
    grid-template-columns: minmax(0, var(--pane-host-side-width)) minmax(0, 1fr);
  }

  &--no-left.pane-host--no-right {
    grid-template-columns: minmax(0, 1fr);
  }
}

.pane-host__side {
  display: flex;
  flex-direction: column;
  min-width: var(--pane-host-side-width);
  max-width: clamp(200px, 22vw, 300px);
  pointer-events: auto;

  &--left {
    align-items: stretch;
  }

  &--right {
    align-items: stretch;
  }
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
  inset: 0;
  background: rgba(10, 8, 6, 0.78);
  display: grid;
  align-items: center;
  justify-items: center;
  padding: var(--space-2xl) var(--space-lg);
  z-index: 40;
}

.pane-host__overlay-card {
  max-width: min(720px, 94vw);
  width: 100%;
}

.pane-host__overlay--fullscreen {
  padding: clamp(var(--space-lg), 3vw, var(--space-2xl));
}

.pane-host__overlay-card--fullscreen {
  max-width: none;
  width: min(96vw, 100%);
  height: min(92vh, 100%);
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

.pane-host--tablet .pane-host__side {
  min-width: clamp(260px, 48vw, 420px);
}

.pane-host--mobile .pane-host__overlay {
  padding: var(--space-lg) var(--space-md);
}

.pane-host--mobile .pane-host__side {
  min-width: 100%;
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
