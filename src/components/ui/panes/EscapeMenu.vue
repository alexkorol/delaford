<template>
  <section class="escape-menu" aria-label="Game menu">
    <header class="escape-menu__intro">
      <span class="escape-menu__eyebrow">Verdigris</span>
      <h1>Game Menu</h1>
      <p>The world remains live while this menu is open.</p>
    </header>

    <button
      ref="resumeButton"
      type="button"
      autofocus
      data-pane-autofocus
      class="escape-menu__action escape-menu__action--primary"
      @click="$emit('resume')"
    >
      <span>Resume</span>
      <kbd>Esc</kbd>
    </button>

    <div class="escape-menu__grid">
      <button
        v-for="entry in paneActions"
        :key="entry.pane"
        type="button"
        class="escape-menu__action"
        @click="$emit('open-pane', entry.pane)"
      >
        <span>{{ entry.label }}</span>
        <kbd v-if="entry.hotkey">{{ entry.hotkey }}</kbd>
      </button>
    </div>

    <button
      type="button"
      class="escape-menu__action escape-menu__action--danger"
      @click="$emit('open-pane', 'logout')"
    >
      <span>Log Out</span>
      <small>Progress saves on exit</small>
    </button>
  </section>
</template>

<script>
export default {
  name: 'EscapeMenu',
  emits: ['resume', 'open-pane'],
  data() {
    return {
      paneActions: [
        { pane: 'stats', label: 'Character', hotkey: 'C' },
        { pane: 'inventory', label: 'Inventory', hotkey: 'I' },
        { pane: 'quests', label: 'Quests', hotkey: 'Q' },
        { pane: 'flowerOfLife', label: 'Skill Tree', hotkey: 'P' },
        { pane: 'settings', label: 'Settings', hotkey: '' },
      ],
    };
  },
  mounted() {
    if (typeof window === 'undefined') return;
    window.setTimeout(() => {
      if (this.$refs.resumeButton && typeof this.$refs.resumeButton.focus === 'function') {
        this.$refs.resumeButton.focus();
      }
    }, 0);
  },
};
</script>

<style scoped lang="scss">
.escape-menu {
  display: flex;
  flex-direction: column;
  gap: 9px;
  width: min(480px, 100%);
  margin: 0 auto;
}

.escape-menu__intro {
  position: relative;
  margin-bottom: 11px;
  padding-bottom: 14px;
  text-align: center;

  &::after {
    content: '';
    position: absolute;
    right: 12%;
    bottom: 0;
    left: 12%;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--color-frame-light), transparent);
  }
}

.escape-menu__intro h1 {
  margin: 2px 0 4px;
  font-family: 'GameFont', Georgia, serif;
  font-size: clamp(1.5rem, 4vw, 2.2rem);
  font-weight: 500;
  color: var(--color-accent-strong);
  letter-spacing: 0.06em;
  text-shadow: 0 2px 0 #000, 0 0 18px rgba(217, 169, 74, 0.2);
}

.escape-menu__intro p,
.escape-menu__eyebrow {
  margin: 0;
  color: var(--color-text-dim);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.escape-menu__eyebrow {
  color: var(--color-accent);
}

.escape-menu__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.escape-menu__action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 45px;
  padding: 10px 14px;
  border: 1px solid var(--color-frame-dark);
  border-top-color: rgba(218, 184, 112, 0.34);
  border-left-color: rgba(218, 184, 112, 0.24);
  border-radius: 0;
  background: var(--control-surface);
  color: var(--color-text-primary);
  font-family: 'GameFont', sans-serif;
  font-size: 0.82rem;
  letter-spacing: 0.04em;
  text-align: left;
  cursor: pointer;
  box-shadow:
    inset 0 0 0 1px rgba(183, 146, 79, 0.1),
    0 2px 8px rgba(0, 0, 0, 0.28);
}

.escape-menu__action:hover,
.escape-menu__action:focus-visible {
  border-color: var(--color-frame-light);
  color: #fff2c9;
  background: var(--control-surface-hover);
  outline: none;
}

.escape-menu__action--primary {
  min-height: 54px;
  border-color: rgba(225, 193, 116, 0.7);
  background:
    linear-gradient(90deg, rgba(139, 48, 52, 0.32), transparent 38%, rgba(49, 91, 122, 0.2)),
    linear-gradient(180deg, #594522, #241a0e);
  color: #fff1c4;
  font-size: 0.95rem;
}

.escape-menu__action--danger {
  border-color: rgba(139, 48, 52, 0.56);
  color: #ddb0a8;
}

.escape-menu__action--danger:hover,
.escape-menu__action--danger:focus-visible {
  border-color: #b85c54;
  background: linear-gradient(180deg, #552a28, #241313);
}

.escape-menu__action small {
  color: rgba(231, 218, 190, 0.52);
  font-family: sans-serif;
  font-size: 0.65rem;
  letter-spacing: 0;
}

.escape-menu__grid .escape-menu__action:last-child {
  grid-column: 1 / -1;
}

.escape-menu kbd {
  min-width: 24px;
  padding: 3px 6px;
  border: 1px solid rgba(231, 218, 190, 0.22);
  border-bottom-color: rgba(0, 0, 0, 0.72);
  border-radius: 0;
  background: rgba(0, 0, 0, 0.34);
  color: var(--color-accent-strong);
  font-family: monospace;
  font-size: 0.68rem;
  text-align: center;
}

@media (width <= 560px) {
  .escape-menu__grid {
    grid-template-columns: 1fr;
  }
}
</style>
