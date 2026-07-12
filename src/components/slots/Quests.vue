<template>
  <div class="quests">
    <article
      class="quest"
      :class="{ 'quest--complete': quest.completed }"
    >
      <header>
        <div>
          <span class="quest__eyebrow">Active Chronicle</span>
          <h2 class="name">{{ quest.title }}</h2>
        </div>
        <span class="status">{{ quest.status }}</span>
      </header>
      <p class="objective">
        {{ quest.objective }}
      </p>
      <p class="reward">
        Reward: {{ quest.reward }}
      </p>
    </article>
  </div>
</template>

<script>
import { presentFirstGoal } from '@/core/quests.js';

export default {
  props: {
    game: {
      type: Object,
      required: true,
    },
  },
  computed: {
    quest() {
      return presentFirstGoal(this.game.player?.quests?.firstGoal);
    },
  },
};
</script>

<style lang="scss" scoped>
div.quests {
  width: 100%;

  article.quest {
    padding: 18px;
    border: 1px solid var(--color-border-strong);
    outline: 1px solid #100c08;
    outline-offset: -4px;
    background:
      linear-gradient(90deg, rgba(139, 48, 52, 0.12), transparent 36%),
      var(--color-bg-inset);
    box-shadow: inset 0 0 24px rgba(0, 0, 0, 0.58);
    box-sizing: border-box;
    margin: 0;
    text-align: left;
    font-size: 13px;
    line-height: 1.55;
    color: var(--color-text-primary);

    header {
      display: flex;
      gap: 8px;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid var(--color-border-subtle);
      padding-bottom: 12px;
    }

    .name {
      margin: 4px 0 0;
      color: var(--color-accent-strong);
      text-shadow: 0 2px 0 #000;
      font: 500 0.95rem "GameFont", sans-serif;
    }

    .quest__eyebrow {
      color: var(--color-text-dim);
      font-size: 0.58rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .status {
      padding: 5px 7px;
      color: var(--color-accent);
      background: rgba(183, 146, 79, 0.08);
      border: 1px solid var(--color-border-subtle);
      font-size: 9px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .objective {
      margin: 16px 0;
      font-family: "ChatFont", sans-serif;
    }

    .reward {
      color: #9fbd81;
      margin: 0;
      font-size: 11px;
    }

    &.quest--complete {
      .name,
      .status {
        color: #8fcf8a;
      }
    }
  }
}
</style>
