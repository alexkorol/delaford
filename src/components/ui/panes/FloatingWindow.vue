<template>
  <section
    v-if="open"
    ref="windowRef"
    class="floating-window"
    :class="floatingClasses"
    :style="floatingStyle"
    @pointerdown="handleFocus"
  >
    <header
      class="floating-window__header"
      @pointerdown.stop.prevent="beginDrag"
      @dblclick.stop="handleDoubleClick"
    >
      <div class="floating-window__title">{{ title }}</div>
      <div class="floating-window__actions">
        <slot name="actions" />
        <button
          v-if="allowGhostToggle"
          type="button"
          class="floating-window__action-btn"
          :class="{ 'floating-window__action-btn--active': isGhost }"
          :title="isGhost ? 'Make opaque' : 'Make transparent'"
          aria-label="Toggle transparency"
          @click.stop="toggleGhost"
        >
          <span aria-hidden="true">{{ isGhost ? '&#9673;' : '&#9675;' }}</span>
        </button>
        <button
          type="button"
          class="floating-window__action-btn"
          :class="{ 'floating-window__action-btn--active': dock !== 'floating' }"
          :title="dock !== 'floating' ? 'Undock (float)' : 'Dock to side'"
          aria-label="Toggle dock"
          @click.stop="toggleDock"
        >
          <span aria-hidden="true">{{ dock !== 'floating' ? '&#8862;' : '&#9638;' }}</span>
        </button>
        <button
          v-if="closable"
          type="button"
          class="floating-window__action-btn floating-window__action-btn--close"
          title="Close"
          aria-label="Close"
          @click.stop="requestClose"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
    </header>
    <div class="floating-window__body">
      <slot />
    </div>
  </section>
</template>

<script>
import { computed, onBeforeUnmount, ref } from 'vue';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default {
  name: 'FloatingWindow',
  props: {
    title: {
      type: String,
      default: '',
    },
    open: {
      type: Boolean,
      default: true,
    },
    position: {
      type: Object,
      default: () => ({ x: 24, y: 24 }),
    },
    dock: {
      type: String,
      default: 'floating', // floating | left | right | bottom | top
    },
    dockOptions: {
      type: Array,
      default: () => ['floating', 'left', 'right', 'bottom'],
    },
    width: {
      type: [String, Number],
      default: '420px',
    },
    height: {
      type: [String, Number, null],
      default: null,
    },
    minWidth: {
      type: [String, Number],
      default: '320px',
    },
    minHeight: {
      type: [String, Number],
      default: '140px',
    },
    zIndex: {
      type: Number,
      default: 30,
    },
    snapDistance: {
      type: Number,
      default: 32,
    },
    snapDocking: {
      type: Boolean,
      default: false,
    },
    enableDoubleClickDock: {
      type: Boolean,
      default: false,
    },
    allowGhostToggle: {
      type: Boolean,
      default: true,
    },
    closable: {
      type: Boolean,
      default: true,
    },
    bounds: {
      type: Object,
      default: () => ({
        left: 0,
        top: 0,
        width: typeof window !== 'undefined' ? window.innerWidth : 0,
        height: typeof window !== 'undefined' ? window.innerHeight : 0,
      }),
    },
  },
  emits: ['update:position', 'update:dock', 'close', 'focus'],
  setup(props, { emit }) {
    const windowRef = ref(null);
    const dragOffset = ref({ x: 0, y: 0 });
    const dragging = ref(false);
    const lastFloatingPosition = ref({ ...props.position });
    const preferredDock = ref(props.dock !== 'floating' ? props.dock : 'right');
    const dragStartedFromDock = ref(false);
    const dragMoved = ref(false);
    const dragStartPoint = ref({ x: 0, y: 0 });
    const detachPosition = ref({ ...props.position });
    const isGhost = ref(false);

    const normaliseSize = (value) => (typeof value === 'number' ? `${value}px` : value || 'auto');

    const floatingStyle = computed(() => {
      if (!props.open) {
        return {};
      }

      if (props.dock !== 'floating') {
        const inset = '12px';
        const dockStyles = {
          left: { left: inset, top: inset, width: normaliseSize(props.width), height: normaliseSize(props.height) },
          right: { right: inset, top: inset, width: normaliseSize(props.width), height: normaliseSize(props.height) },
          bottom: { left: inset, right: inset, bottom: inset, width: 'auto' },
          top: { left: inset, right: inset, top: inset, width: 'auto' },
        };
        return {
          zIndex: props.zIndex,
          minWidth: normaliseSize(props.minWidth),
          minHeight: normaliseSize(props.minHeight),
          ...(dockStyles[props.dock] || {}),
        };
      }

      return {
        left: `${props.position.x}px`,
        top: `${props.position.y}px`,
        width: normaliseSize(props.width),
        height: normaliseSize(props.height),
        minWidth: normaliseSize(props.minWidth),
        minHeight: normaliseSize(props.minHeight),
        zIndex: props.zIndex,
      };
    });

    const floatingClasses = computed(() => ({
      'floating-window--floating': props.dock === 'floating',
      [`floating-window--dock-${props.dock}`]: props.dock && props.dock !== 'floating',
      'floating-window--ghost': isGhost.value,
    }));

    const stopDragging = () => {
      if (!dragging.value) {
        return;
      }

      const shouldSnap = props.snapDocking && props.dock === 'floating' && dragMoved.value;
      dragging.value = false;
      dragStartedFromDock.value = false;
      dragMoved.value = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDragging);

      if (shouldSnap) {
        snapToEdge();
      }
    };

    const handlePointerMove = (event) => {
      if (!dragging.value) {
        return;
      }
      if (!dragMoved.value) {
        const dx = Math.abs(event.clientX - dragStartPoint.value.x);
        const dy = Math.abs(event.clientY - dragStartPoint.value.y);
        if (dx < 3 && dy < 3) {
          return;
        }
        dragMoved.value = true;
        if (dragStartedFromDock.value) {
          emit('update:dock', 'floating');
          emit('update:position', detachPosition.value);
          lastFloatingPosition.value = { ...detachPosition.value };
        }
      }

      const bounds = props.bounds || {};
      const rect = windowRef.value ? windowRef.value.getBoundingClientRect() : null;
      const width = rect ? rect.width : 0;
      const height = rect ? rect.height : 0;
      const maxX = Math.max(0, (bounds.width || 0) - width);
      const maxY = Math.max(0, (bounds.height || 0) - height);
      const nextX = clamp(event.clientX - (bounds.left || 0) - dragOffset.value.x, 0, maxX || 0);
      const nextY = clamp(event.clientY - (bounds.top || 0) - dragOffset.value.y, 0, maxY || 0);
      emit('update:position', { x: nextX, y: nextY });
      lastFloatingPosition.value = { x: nextX, y: nextY };
    };

    const beginDrag = (event) => {
      if (event.button !== 0) {
        return;
      }
      emit('focus');
      const bounds = props.bounds || {};
      const rect = windowRef.value ? windowRef.value.getBoundingClientRect() : null;
      const originX = rect ? rect.left - (bounds.left || 0) : props.position.x || 0;
      const originY = rect ? rect.top - (bounds.top || 0) : props.position.y || 0;
      detachPosition.value = { x: originX, y: originY };
      dragStartPoint.value = { x: event.clientX, y: event.clientY };
      dragOffset.value = {
        x: event.clientX - (bounds.left || 0) - originX,
        y: event.clientY - (bounds.top || 0) - originY,
      };
      dragging.value = true;
      dragMoved.value = false;
      dragStartedFromDock.value = props.dock !== 'floating';
      lastFloatingPosition.value = { x: originX, y: originY };
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', stopDragging);
    };

    const clampFloatingPosition = (position = {}) => {
      const bounds = props.bounds || {};
      const rect = windowRef.value ? windowRef.value.getBoundingClientRect() : null;
      const width = rect ? rect.width : 0;
      const height = rect ? rect.height : 0;
      const maxX = Math.max(0, (bounds.width || 0) - width);
      const maxY = Math.max(0, (bounds.height || 0) - height);
      return {
        x: clamp(position.x || 0, 0, maxX || 0),
        y: clamp(position.y || 0, 0, maxY || 0),
      };
    };

    const applyDock = (dock) => {
      if (dock === 'floating' && props.dock !== 'floating') {
        emit('update:position', clampFloatingPosition(lastFloatingPosition.value));
      }
      if (dock !== 'floating') {
        preferredDock.value = dock;
      }
      emit('update:dock', dock);
    };

    const snapToEdge = () => {
      const bounds = props.bounds || {};
      const rect = windowRef.value ? windowRef.value.getBoundingClientRect() : null;
      const width = rect ? rect.width : 0;
      const height = rect ? rect.height : 0;
      const maxX = Math.max(0, (bounds.width || 0) - width);
      const maxY = Math.max(0, (bounds.height || 0) - height);
      const { x = 0, y = 0 } = lastFloatingPosition.value || {};

      const nearLeft = x <= props.snapDistance;
      const nearRight = x >= (maxX - props.snapDistance);
      const nearTop = y <= props.snapDistance;
      const nearBottom = y >= (maxY - props.snapDistance);

      if (nearLeft) {
        emit('update:dock', 'left');
        preferredDock.value = 'left';
        return;
      }
      if (nearRight) {
        emit('update:dock', 'right');
        preferredDock.value = 'right';
        return;
      }
      if (nearBottom) {
        emit('update:dock', 'bottom');
        preferredDock.value = 'bottom';
        return;
      }
      if (nearTop) {
        emit('update:dock', 'top');
        preferredDock.value = 'top';
      }
    };

    const requestClose = () => {
      emit('close');
    };

    const toggleDock = () => {
      if (props.dock === 'floating') {
        emit('update:dock', preferredDock.value || 'right');
        return;
      }
      emit('update:dock', 'floating');
      emit('update:position', clampFloatingPosition(lastFloatingPosition.value));
    };

    const handleDoubleClick = () => {
      if (!props.enableDoubleClickDock) {
        return;
      }
      toggleDock();
    };

    const toggleGhost = () => {
      if (!props.allowGhostToggle) {
        return;
      }
      isGhost.value = !isGhost.value;
    };

    const dockLabel = (dock) => {
      switch (dock) {
        case 'left':
          return '⟸';
        case 'right':
          return '⟹';
        case 'top':
          return '⇑';
        case 'bottom':
          return '⇓';
        default:
          return '⬚';
      }
    };

    const handleFocus = () => {
      emit('focus');
    };

    onBeforeUnmount(() => {
      stopDragging();
    });

    return {
      windowRef,
      floatingStyle,
      floatingClasses,
      beginDrag,
      toggleDock,
      handleDoubleClick,
      toggleGhost,
      applyDock,
      dockLabel,
      requestClose,
      handleFocus,
      isGhost,
    };
  },
};
</script>

<style scoped lang="scss">
@use '@/assets/scss/abstracts/tokens' as *;

.floating-window {
  position: absolute;
  background:
    linear-gradient(180deg, rgba(255, 244, 205, 0.05), rgba(255, 244, 205, 0) 30%),
    linear-gradient(180deg, #191b1d 0%, #101113 100%);
  border: 2px solid #16100a;
  border-top-color: #806b45;
  border-left-color: #6f5a3a;
  border-radius: var(--radius-md);
  box-shadow:
    inset 0 0 0 1px rgba(215, 180, 103, 0.16),
    inset 0 -20px 28px rgba(0, 0, 0, 0.55),
    0 10px 26px rgba(0, 0, 0, 0.72);
  color: var(--color-text-primary);
  pointer-events: auto;
  overflow: hidden;
  user-select: none;
}

.floating-window__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  min-height: 34px;
  padding: 6px var(--space-sm);
  background:
    linear-gradient(90deg, rgba(110, 20, 28, 0.42), rgba(20, 22, 26, 0.35) 42%, rgba(26, 44, 70, 0.28)),
    linear-gradient(180deg, #2d2b28 0%, #191816 100%);
  border-bottom: 1px solid rgba(215, 180, 103, 0.28);
  cursor: grab;
  touch-action: none;

  &:active {
    cursor: grabbing;
  }
}

.floating-window__title {
  font-family: 'GameFont', sans-serif;
  font-size: 12px;
  letter-spacing: 0;
  text-transform: uppercase;
  color: #f2d391;
  text-shadow: 0 1px 0 #000, 0 0 8px rgba(217, 169, 74, 0.28);
  user-select: none;
}

.floating-window__actions {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.floating-window__action-btn {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  border: 1px solid #24170e;
  background: linear-gradient(180deg, #3b3d42 0%, #18191d 100%);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-family: 'GameFont', sans-serif;

  &:hover {
    background: linear-gradient(180deg, #444850 0%, #202228 100%);
    border-color: var(--color-border-strong);
    color: var(--color-text-primary);
  }

  &--active {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  &--close:hover {
    color: var(--color-danger);
    background: linear-gradient(180deg, #4a2020 0%, #2a1010 100%);
    border-color: var(--color-danger);
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
}

.floating-window__body {
  padding: var(--space-sm);
  min-height: 80px;
  max-height: 80vh;
  overflow: auto;
  background:
    radial-gradient(circle at 18% 0%, rgba(95, 25, 30, 0.12), transparent 28%),
    radial-gradient(circle at 82% 0%, rgba(26, 55, 92, 0.11), transparent 24%);
}

.floating-window--ghost {
  opacity: 0.5;
}

.floating-window--dock-left,
.floating-window--dock-right {
  height: auto;
}

.floating-window--dock-bottom,
.floating-window--dock-top {
  max-height: 50vh;
}
</style>
