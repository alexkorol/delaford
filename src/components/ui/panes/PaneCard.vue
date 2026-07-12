<template>
  <section
    class="pane-card"
    :class="{
      'pane-card--compressed': compressed,
      'pane-card--minimal-header': minimalHeader,
    }"
    :aria-label="ariaLabel"
  >
    <header class="pane-card__header">
      <h2 :class="['pane-card__title', { 'sr-only': minimalHeader }]">{{ title }}</h2>
      <div class="pane-card__actions">
        <slot name="actions" />
        <button
          v-if="dismissible"
          class="pane-card__dismiss"
          type="button"
          @click="$emit('dismiss')"
        >
          <span class="sr-only">Close</span>
          &times;
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
    minimalHeader: {
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
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  border-radius: var(--radius-md);
  background: var(--panel-surface);
  border: 1px solid var(--color-frame-black);
  outline: 1px solid rgba(151, 118, 61, 0.62);
  outline-offset: -4px;
  box-shadow:
    inset 0 0 0 2px #20170e,
    inset 0 0 0 5px rgba(4, 5, 6, 0.86),
    inset 0 22px 30px rgba(255, 245, 207, 0.025),
    inset 0 -24px 34px rgba(0, 0, 0, 0.64),
    var(--shadow-strong);
  color: var(--color-text-primary);
  overflow: hidden;
}

.pane-card::before,
.pane-card::after {
  content: '';
  position: absolute;
  left: 14px;
  right: 14px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(225, 193, 116, 0.56), transparent);
  pointer-events: none;
  z-index: 1;
}

.pane-card::before {
  top: 7px;
}

.pane-card::after {
  bottom: 7px;
}

.pane-card--compressed {
  border-radius: var(--radius-sm);
}

.pane-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 42px;
  padding: 9px 16px 9px 18px;
  gap: var(--space-md);
  background: var(--panel-header);
  border-bottom: 1px solid rgba(183, 146, 79, 0.48);
  box-shadow:
    inset 0 -1px 0 rgba(0, 0, 0, 0.9),
    inset 0 1px 0 rgba(228, 204, 147, 0.08);
}

.pane-card__title {
  font-family: 'GameFont', sans-serif;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-accent-strong);
  text-shadow: 0 2px 0 #000, 0 0 10px rgba(217, 169, 74, 0.22);
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
  background: var(--control-surface);
  color: var(--color-text-secondary);
  border-radius: 0;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;

  &:hover {
    color: var(--color-danger);
    background: linear-gradient(180deg, #452126 0%, #1d1012 100%);
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
}

.pane-card__body {
  position: relative;
  padding: 18px;
  overflow: auto;
  max-height: min(72vh, 640px);
  background:
    linear-gradient(90deg, rgba(183, 146, 79, 0.035) 1px, transparent 1px),
    linear-gradient(rgba(183, 146, 79, 0.025) 1px, transparent 1px),
    linear-gradient(180deg, rgba(6, 7, 8, 0.26), rgba(0, 0, 0, 0.12));
  background-size: 32px 32px, 32px 32px, auto;
}

.pane-card--minimal-header {
  overflow: visible;
}

.pane-card--minimal-header .pane-card__header {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 4;
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.pane-card--minimal-header .pane-card__body {
  height: 100%;
  padding: 0;
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
