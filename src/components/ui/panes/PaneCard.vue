<template>
  <section
    class="pane-card"
    :class="{ 'pane-card--compressed': compressed }"
    :aria-label="ariaLabel"
  >
    <header class="pane-card__header">
      <h2 class="pane-card__title">{{ title }}</h2>
      <div class="pane-card__actions">
        <slot name="actions" />
        <button
          v-if="dismissible"
          class="pane-card__dismiss"
          type="button"
          @click="$emit('dismiss')"
        >
          <span class="sr-only">Close</span>
          ×
        </button>
      </div>
    </header>
    <div class="pane-card__body">
      <slot />
    </div>
  </section>
</template>

<script>
export default {
  name: 'PaneCard',
  props: {
    title: {
      type: String,
      default: '',
    },
    compressed: {
      type: Boolean,
      default: false,
    },
    dismissible: {
      type: Boolean,
      default: false,
    },
    ariaLabel: {
      type: String,
      default: '',
    },
  },
  emits: ['dismiss'],
};
</script>

<style lang="scss" scoped>
@use '@/assets/scss/abstracts/tokens' as *;

.pane-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  border-radius: var(--radius-md);
  background: linear-gradient(180deg, #28221a 0%, #1a1610 100%);
  border: 2px solid var(--color-frame-dark);
  border-top-color: var(--color-bevel-light);
  border-left-color: var(--color-bevel-light);
  box-shadow:
    inset 1px 1px 0 rgba(200, 180, 140, 0.12),
    inset -1px -1px 0 rgba(0, 0, 0, 0.35),
    0 6px 18px rgba(0, 0, 0, 0.6);
  color: var(--color-text-primary);
  overflow: hidden;
}

.pane-card--compressed {
  border-radius: var(--radius-sm);
}

.pane-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  gap: var(--space-md);
  background: linear-gradient(180deg, rgba(70, 60, 42, 0.6) 0%, rgba(40, 34, 24, 0.6) 100%);
  border-bottom: 1px solid var(--color-frame-dark);
}

.pane-card__title {
  font-family: 'GameFont', sans-serif;
  font-size: clamp(12px, 1.2vw, 15px);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-accent);
  margin: 0;
}

.pane-card__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
}

.pane-card__dismiss {
  appearance: none;
  border: 1px solid var(--color-frame-dark);
  background: linear-gradient(180deg, #4a4030 0%, #2a2418 100%);
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;

  &:hover {
    color: var(--color-danger);
    background: linear-gradient(180deg, #4a3020 0%, #2a1610 100%);
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
}

.pane-card__body {
  padding: var(--space-md);
  overflow: auto;
  max-height: min(72vh, 640px);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
