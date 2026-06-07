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
  background:
    linear-gradient(180deg, rgba(255, 244, 205, 0.05), rgba(255, 244, 205, 0) 30%),
    linear-gradient(180deg, #191b1d 0%, #101113 100%);
  border: 2px solid #16100a;
  border-top-color: #806b45;
  border-left-color: #6f5a3a;
  box-shadow:
    inset 0 0 0 1px rgba(215, 180, 103, 0.16),
    inset 0 18px 26px rgba(255, 255, 255, 0.03),
    inset 0 -20px 28px rgba(0, 0, 0, 0.55),
    0 10px 26px rgba(0, 0, 0, 0.72);
  color: var(--color-text-primary);
  overflow: hidden;
}

.pane-card::before,
.pane-card::after {
  content: '';
  position: absolute;
  left: 10px;
  right: 10px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(215, 180, 103, 0.55), transparent);
  pointer-events: none;
  z-index: 1;
}

.pane-card::before {
  top: 5px;
}

.pane-card::after {
  bottom: 5px;
}

.pane-card--compressed {
  border-radius: var(--radius-sm);
}

.pane-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 34px;
  padding: 7px var(--space-md);
  gap: var(--space-md);
  background:
    linear-gradient(90deg, rgba(110, 20, 28, 0.42), rgba(20, 22, 26, 0.35) 42%, rgba(26, 44, 70, 0.28)),
    linear-gradient(180deg, #2d2b28 0%, #191816 100%);
  border-bottom: 1px solid rgba(215, 180, 103, 0.28);
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.75);
}

.pane-card__title {
  font-family: 'GameFont', sans-serif;
  font-size: 13px;
  letter-spacing: 0;
  text-transform: uppercase;
  color: #f2d391;
  text-shadow: 0 1px 0 #000, 0 0 8px rgba(217, 169, 74, 0.28);
  margin: 0;
}

.pane-card__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
}

.pane-card__dismiss {
  appearance: none;
  border: 1px solid #24170e;
  background: linear-gradient(180deg, #3b3d42 0%, #18191d 100%);
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
    background: linear-gradient(180deg, #452126 0%, #1d1012 100%);
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
}

.pane-card__body {
  position: relative;
  padding: var(--space-md);
  overflow: auto;
  max-height: min(72vh, 640px);
  background:
    radial-gradient(circle at 18% 0%, rgba(95, 25, 30, 0.16), transparent 28%),
    radial-gradient(circle at 82% 0%, rgba(26, 55, 92, 0.14), transparent 24%),
    linear-gradient(180deg, rgba(9, 10, 11, 0.18), rgba(0, 0, 0, 0.08));
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
