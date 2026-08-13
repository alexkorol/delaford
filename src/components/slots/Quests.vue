<template>
  <div class="quest-journal">
    <section v-if="activeQuest" class="quest-card">
      <p class="quest-card__eyebrow">Active commission</p>
      <h3>{{ activeQuest.title }}</h3>
      <p class="quest-card__description">{{ activeQuest.description }}</p>

      <ol class="quest-objectives">
        <li
          v-for="(objective, index) in activeQuest.objectives"
          :key="objective.id"
          :class="{
            'quest-objectives__item--complete': index < objectiveIndex,
            'quest-objectives__item--current': index === objectiveIndex,
          }"
          class="quest-objectives__item"
        >
          <span aria-hidden="true">{{ index < objectiveIndex ? '◆' : index === objectiveIndex ? '◇' : '·' }}</span>
          {{ objective.label }}
        </li>
      </ol>

      <div class="quest-rewards">
        <span>Reward</span>
        <strong>+{{ activeQuest.rewards.passivePoints }} passive point</strong>
        <strong>+{{ activeQuest.rewards.houseRenown }} House renown</strong>
      </div>
    </section>

    <p v-else class="quest-journal__empty">
      No active commission. Delaford will remember what you have finished.
    </p>

    <section v-if="completedQuests.length" class="quest-completed">
      <p>Completed</p>
      <ul>
        <li v-for="quest in completedQuests" :key="quest.id">{{ quest.title }}</li>
      </ul>
    </section>
  </div>
</template>

<script>
import { getQuestDefinition } from '@shared/quests.js';

export default {
  props: {
    game: {
      type: Object,
      required: true,
    },
  },
  computed: {
    questState() {
      return this.game?.player?.quests || {};
    },
    activeQuest() {
      return getQuestDefinition(this.questState.activeQuestId);
    },
    objectiveIndex() {
      return Math.max(0, Number(this.questState.objectiveIndex) || 0);
    },
    completedQuests() {
      return (Array.isArray(this.questState.completed) ? this.questState.completed : [])
        .map(entry => getQuestDefinition(entry.id))
        .filter(Boolean);
    },
  },
};
</script>

<style lang="scss" scoped>
.quest-journal {
  width: min(360px, 78vw);
  color: #ddd1b5;
  font: 0.72rem 'ChatFont', sans-serif;
}

.quest-card {
  padding: 14px;
  background: linear-gradient(145deg, rgba(24, 29, 23, 0.97), rgba(15, 18, 15, 0.98));
  border: 1px solid rgba(113, 174, 143, 0.55);
  box-shadow: inset 0 0 24px rgba(0, 0, 0, 0.34);

  h3 {
    margin: 4px 0 8px;
    color: #e3c786;
    font: 1.05rem 'GameFont', sans-serif;
    letter-spacing: 0.04em;
  }
}

.quest-card__eyebrow,
.quest-completed > p {
  margin: 0;
  color: #79b69a;
  font: 0.62rem 'GameFont', sans-serif;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.quest-card__description {
  margin: 0 0 12px;
  color: rgba(221, 209, 181, 0.72);
  line-height: 1.45;
}

.quest-objectives {
  display: grid;
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.quest-objectives__item {
  display: flex;
  gap: 8px;
  color: rgba(221, 209, 181, 0.42);

  &--current {
    color: #f1e3bf;
  }

  &--complete {
    color: #77ae8f;
    text-decoration: line-through;
    text-decoration-color: rgba(119, 174, 143, 0.48);
  }
}

.quest-rewards {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 3px 10px;
  margin-top: 14px;
  padding-top: 9px;
  border-top: 1px solid rgba(227, 199, 134, 0.2);

  span {
    grid-row: span 2;
    color: rgba(221, 209, 181, 0.48);
    text-transform: uppercase;
  }

  strong {
    color: #d6bd7d;
    font-weight: normal;
  }
}

.quest-journal__empty {
  margin: 0;
  padding: 16px;
  color: rgba(221, 209, 181, 0.58);
  border: 1px solid rgba(221, 209, 181, 0.2);
}

.quest-completed {
  margin-top: 12px;
  padding: 10px 12px;
  border-left: 2px solid rgba(113, 174, 143, 0.48);

  ul {
    margin: 6px 0 0;
    padding: 0;
    color: rgba(221, 209, 181, 0.62);
    list-style: none;
  }
}
</style>
