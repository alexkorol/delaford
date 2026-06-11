<template>
  <div class="stats_slot">
    <section class="skill-tree">
      <header>Skill Tree</header>
      <p class="summary">
        <strong>{{ flowerSummary.spent }}</strong>
        <span>/</span>
        <span>{{ flowerSummary.total }}</span>
        petals spent
      </p>
      <p class="available">
        {{ flowerSummary.available }} petal{{ flowerSummary.available === 1 ? '' : 's' }} available
      </p>
      <button
        type="button"
        class="flower-button"
        @click="openSkillTree"
      >
        Open Skill Tree
      </button>
    </section>

    <section class="attributes">
      <header>Attributes</header>
      <ul>
        <li
          v-for="attribute in attributes"
          :key="attribute.id"
        >
          <span class="label">{{ attribute.label }}</span>
          <span class="value">{{ attribute.value }}</span>
          <small class="breakdown">
            <span class="base">B {{ attribute.breakdown.base }}</span>
            <span class="gear">G {{ attribute.breakdown.equipment }}</span>
            <span class="bonus">+ {{ attribute.breakdown.bonuses }}</span>
            <span class="passive">P {{ attribute.breakdown.passives }}</span>
          </small>
        </li>
      </ul>
    </section>

    <section class="lifecycle">
      <header>Life &amp; Death</header>
      <ul>
        <li>
          <span class="label">State</span>
          <span class="value">{{ lifecycleState }}</span>
        </li>
        <li>
          <span class="label">Deaths</span>
          <span class="value">{{ lifecycle.deaths }}</span>
        </li>
        <li>
          <span class="label">Lives</span>
          <span class="value">{{ lifecycle.livesRemaining }}</span>
        </li>
        <li>
          <span class="label">Cheat Death</span>
          <span class="value">{{ cheatDeathSummary }}</span>
        </li>
        <li>
          <span class="label">Respawn</span>
          <span class="value">{{ respawnSummary }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<script>
import { mapStores } from 'pinia';
import { ATTRIBUTE_IDS, ATTRIBUTE_LABELS, aggregateAttributes } from '@shared/stats/index.js';
import {
  computeAvailablePetalCount,
  sumAllocatedCost,
  computeFlowerAttributeBonuses,
  FLOWER_OF_LIFE_DEFAULT_PROGRESS,
} from '@shared/passives/flower-of-life.js';
import bus from '@/core/utilities/bus';
import { useUiStore } from '@/stores/ui.js';

const normaliseNumber = value => (Number.isFinite(value) ? value : 0);
const normaliseAttributes = (source = {}) => ATTRIBUTE_IDS.reduce((acc, attributeId) => {
  acc[attributeId] = normaliseNumber(source[attributeId]);
  return acc;
}, {});

export default {
  props: {
    game: {
      type: Object,
      required: true,
    },
  },
  computed: {
    ...mapStores(useUiStore),
    player() {
      return this.game && this.game.player ? this.game.player : {};
    },
    flowerProgress() {
      return this.uiStore?.flowerOfLifeState || FLOWER_OF_LIFE_DEFAULT_PROGRESS;
    },
    flowerSummary() {
      const summary = computeAvailablePetalCount(this.player, this.flowerProgress);
      const spent = sumAllocatedCost(this.flowerProgress.allocatedNodes || []);
      const available = Math.max(0, summary.total - spent);
      return {
        total: summary.total,
        spent,
        available,
      };
    },
    stats() {
      if (!this.player) {
        return {};
      }

      return this.player.stats || {};
    },
    attributeSources() {
      const sources = this.stats.attributes && this.stats.attributes.sources
        ? this.stats.attributes.sources
        : {};

      return {
        base: sources.base || {},
        equipment: sources.equipment || {},
        bonuses: sources.bonuses || {},
        passives: sources.passives || {},
      };
    },
    passiveAttributeBonuses() {
      return computeFlowerAttributeBonuses(this.flowerProgress);
    },
    attributes() {
      const base = normaliseAttributes(this.attributeSources.base);
      const equipment = normaliseAttributes(this.attributeSources.equipment);
      const bonuses = normaliseAttributes(this.attributeSources.bonuses);
      const passiveFromStats = normaliseAttributes(this.attributeSources.passives);
      const passiveLocal = normaliseAttributes(this.passiveAttributeBonuses);

      const passives = normaliseAttributes({});
      const hasServerPassive = ATTRIBUTE_IDS.some(attributeId => passiveFromStats[attributeId] !== 0);
      ATTRIBUTE_IDS.forEach((attributeId) => {
        const localContribution = hasServerPassive ? 0 : passiveLocal[attributeId];
        passives[attributeId] = passiveFromStats[attributeId] + localContribution;
      });

      const aggregated = aggregateAttributes({
        base,
        equipment,
        bonuses,
        passives,
      });

      return ATTRIBUTE_IDS.map((attributeId) => {
        const breakdown = {
          base: normaliseNumber(aggregated.sources.base[attributeId]),
          equipment: normaliseNumber(aggregated.sources.equipment[attributeId]),
          bonuses: normaliseNumber(aggregated.sources.bonuses[attributeId]),
          passives: normaliseNumber(aggregated.sources.passives[attributeId]),
        };

        return {
          id: attributeId,
          label: ATTRIBUTE_LABELS[attributeId] || attributeId,
          value: normaliseNumber(aggregated.total[attributeId]),
          breakdown,
        };
      });
    },
    lifecycle() {
      const lifecycle = this.player.lifecycle
        || (this.stats ? this.stats.lifecycle : null)
        || {};

      return {
        state: lifecycle.state || 'unknown',
        mode: lifecycle.mode || 'soft',
        deaths: normaliseNumber(lifecycle.deaths),
        livesRemaining: normaliseNumber(lifecycle.livesRemaining),
        cheatDeath: lifecycle.cheatDeath || {},
        respawn: lifecycle.respawn || {},
      };
    },
    lifecycleState() {
      const label = this.lifecycle.state || 'unknown';
      return label.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
    },
    cheatDeathSummary() {
      const { cheatDeath } = this.lifecycle;
      const charges = normaliseNumber(cheatDeath.charges);
      if (charges <= 0) {
        return 'None';
      }

      const cooldown = normaliseNumber(cheatDeath.cooldownMs);
      if (cooldown > 0) {
        const seconds = Math.round(cooldown / 1000);
        return `${charges} (${seconds}s cd)`;
      }

      return `${charges} ready`;
    },
    respawnSummary() {
      const { respawn } = this.lifecycle;
      if (this.lifecycle.state === 'permadead') {
        return 'Locked';
      }

      if (!respawn || !respawn.pending) {
        return 'Ready';
      }

      if (respawn.at) {
        const remainingMs = respawn.at - Date.now();
        const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
        return `Pending (${remainingSeconds}s)`;
      }

      return 'Pending';
    },
  },
  methods: {
    openSkillTree() {
      bus.$emit('skill-tree:open');
    },
  },
};
</script>

<style lang="scss" scoped>
section.skill-tree {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  align-items: flex-start;

  header {
    font-size: var(--font-size-sm);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #f5d68a;
  }

  .summary {
    margin: 0;
    font-size: var(--font-size-sm);
    display: flex;
    gap: var(--space-xs);
    align-items: baseline;

    strong {
      color: #ffd54f;
    }
  }

  .available {
    margin: 0;
    font-size: var(--font-size-sm);
    color: rgba(255, 255, 255, 0.75);
  }

  .flower-button {
    margin-top: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    border: 1px solid rgba(255, 255, 255, 0.25);
    background: rgba(255, 255, 255, 0.08);
    color: #f1f1f1;
    font-size: var(--font-size-sm);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;

    &:hover {
      background: rgba(255, 215, 79, 0.15);
      border-color: rgba(255, 215, 79, 0.5);
    }
  }
}

div.stats_slot {
  height: 100%;
  font-family: "GameFont", sans-serif;
  color: #f1f1f1;
  text-align: left;
  text-shadow: 1px 1px 0 black;
  font-size: var(--font-size-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);

  section {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-sm);
    padding: var(--space-sm);

    header {
      font-size: var(--font-size-sm);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: var(--space-xs);
      color: #f5d68a;
    }

    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);

      li {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: var(--space-xs);
        align-items: baseline;

        .label {
          text-transform: capitalize;
        }

        .value {
          font-weight: bold;
        }

        .breakdown {
          grid-column: 1 / -1;
          display: flex;
          gap: var(--space-xs);
          opacity: 0.75;
          font-size: 0.85em;

          span {
            display: inline-block;
          }

          .passive {
            color: #80cbc4;
          }
        }
      }
    }
  }
}
</style>
