<template>
  <div class="chartView">
    <pane-header :text="data.roadName || 'Wayfinder\'s Chart'" />
    <p class="chart-blurb">{{ data.blurb }}</p>
    <p v-if="data.houseName" class="chart-house">
      The chart of House {{ data.houseName }} — a record of footsteps. It answers to no one else.
    </p>

    <div class="chart-scroll">
      <section
        v-for="tier in tiers"
        :key="tier.tier"
        class="chart-tier"
      >
        <header class="chart-tier__label">
          <span class="chart-tier__stage">Stage {{ tier.tier }}</span>
          <span class="chart-tier__rule" />
        </header>
        <div class="chart-tier__nodes">
          <button
            v-for="node in tier.nodes"
            :key="node.id"
            type="button"
            class="chart-node"
            :class="`chart-node--${node.status}`"
            :disabled="node.status === 'barred'"
            :title="nodeTitle(node)"
            @click="travel(node)"
          >
            <span class="chart-node__name">{{ node.name }}</span>
            <span class="chart-node__meta">
              <span class="chart-node__level">Lv {{ node.levelHint }}</span>
              <span class="chart-node__status">{{ statusLabel(node) }}</span>
            </span>
          </button>
        </div>
      </section>
    </div>

    <p class="chart-footnote">
      No road holds past a living Warden. Cleared ground lies still for a quarter
      hour after you leave it — then the green closes over your footprints.
    </p>
  </div>
</template>

<script>
import bus from '../../core/utilities/bus.js';
import Socket from '../../core/utilities/socket.js';

export default {
  props: {
    game: {
      type: Object,
      required: true,
    },
    data: {
      type: Object,
      required: true,
    },
  },
  computed: {
    tiers() {
      const grouped = new Map();
      (this.data.nodes || []).forEach((node) => {
        if (!grouped.has(node.tier)) {
          grouped.set(node.tier, { tier: node.tier, nodes: [] });
        }
        grouped.get(node.tier).nodes.push(node);
      });
      return [...grouped.values()].sort((a, b) => a.tier - b.tier);
    },
  },
  methods: {
    statusLabel(node) {
      if (node.status === 'cleared') return 'Warden down';
      if (node.status === 'open') return 'Charted';
      return 'Uncharted';
    },
    nodeTitle(node) {
      if (node.status === 'barred') {
        return 'No road holds here yet — put down the Warden on the stage before it.';
      }
      if (node.status === 'cleared') {
        return `${node.wardenName} is down. Travel freely.`;
      }
      return `${node.wardenName} keeps this ground.`;
    },
    travel(node) {
      if (node.status === 'barred') return;
      Socket.emit('world:zone:enter', { nodeId: node.id });
      bus.$emit('screen:close');
    },
  },
};
</script>

<style lang="scss" scoped>
.chartView {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 5px;
  background: var(--panel-surface);
  font-family: 'GameFont', sans-serif;
  border: 1px solid var(--color-frame-dark);
  outline: 1px solid var(--color-border-strong);
  outline-offset: -4px;
  box-shadow: var(--shadow-strong);

  .chart-blurb {
    margin: 0;
    padding: 9px 12px 4px;
    color: var(--color-text-secondary);
    font: italic 0.74rem/1.5 'ChatFont', sans-serif;
  }

  .chart-house {
    margin: 0;
    padding: 0 12px 8px;
    color: var(--color-text-dim);
    font-size: 0.64rem;
    letter-spacing: 0.04em;
  }

  .chart-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 10px;
    background:
      linear-gradient(135deg, rgba(183, 146, 79, 0.03) 25%, transparent 25%) 0 0 / 8px 8px,
      var(--color-bg-inset);
    border: 1px solid var(--color-border-subtle);

    &::-webkit-scrollbar { width: 8px; }
    &::-webkit-scrollbar-thumb { background-color: rgba(183, 146, 79, 0.46); }
    &::-webkit-scrollbar-track { background-color: transparent; }
  }

  .chart-tier {
    padding: 6px 0 2px;

    &__label {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 5px;
    }

    &__stage {
      color: var(--color-text-dim);
      font-size: 0.62rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    &__rule {
      flex: 1 1 auto;
      height: 1px;
      background: linear-gradient(90deg, rgba(183, 146, 79, 0.35), transparent);
    }

    &__nodes {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
  }

  .chart-node {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 170px;
    padding: 8px 11px;
    text-align: left;
    border: 1px solid var(--color-frame-dark);
    border-top-color: rgba(218, 184, 112, 0.3);
    background: var(--control-surface);
    color: var(--color-accent-strong);
    font-family: 'GameFont', sans-serif;
    cursor: pointer;

    &:hover:not(:disabled) {
      border-color: var(--color-accent-strong, #e0b45c);
      background: var(--control-surface-hover);
      color: #fff0c2;
    }

    &__name {
      font-size: 0.8rem;
    }

    &__meta {
      display: flex;
      justify-content: space-between;
      gap: 10px;
    }

    &__level {
      font-size: 0.62rem;
      color: rgba(148, 180, 214, 0.86);
    }

    &__status {
      font-size: 0.62rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--color-text-dim);
    }

    &--cleared {
      .chart-node__status { color: #79c07a; }
    }

    &--open {
      box-shadow: inset 0 0 0 1px rgba(224, 180, 92, 0.22);

      .chart-node__status { color: var(--color-accent-strong); }
    }

    &--barred {
      opacity: 0.45;
      cursor: default;
    }
  }

  .chart-footnote {
    margin: 0;
    padding: 8px 12px;
    color: var(--color-text-dim);
    font: italic 0.64rem/1.5 'ChatFont', sans-serif;
    border-top: 1px solid var(--color-border-subtle);
  }
}
</style>
