<template>
  <div class="quests">
    <article
      class="quest"
      :class="{ 'quest--complete': quest.completed }"
    >
      <header>
        <span class="name">{{ quest.title }}</span>
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
@use 'sass:color';

div.quests {
  height: 100%;

  article.quest {
    min-height: 100%;
    padding: 10px;
    border: 4px solid color.adjust(grey, $lightness: -10%);
    background-color: color.adjust(grey, $lightness: 8%);
    box-sizing: border-box;
    margin: 0;
    text-align: left;
    font-size: 14px;
    line-height: 1.5em;
    color: #e8ddc4;

    header {
      display: flex;
      gap: 8px;
      justify-content: space-between;
      border-bottom: 1px solid rgba(232, 221, 196, 0.25);
      padding-bottom: 6px;
    }

    .name {
      color: #f2c879;
      text-shadow: 1px 1px 0 black;
      font-family: "ChatFont", sans-serif;
    }

    .status {
      color: #d7aa66;
      font-size: 11px;
      text-transform: uppercase;
    }

    .objective {
      margin: 10px 0;
    }

    .reward {
      color: #a8cf91;
      margin: 0;
      font-size: 12px;
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
