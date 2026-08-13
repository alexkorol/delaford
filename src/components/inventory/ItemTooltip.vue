<template>
  <Teleport to="body">
    <aside
      v-if="item"
      class="item-tooltip"
      :class="`item-tooltip--${model.rarity}`"
      :style="positionStyle"
      role="tooltip"
    >
      <header class="item-tooltip__header">
        <span>{{ model.rarityLabel }}</span>
        <h3>{{ model.name }}</h3>
      </header>

      <div class="item-tooltip__meta">
        <span v-for="entry in model.meta" :key="entry">{{ entry }}</span>
        <strong v-if="model.quantity">Stack {{ model.quantity }}</strong>
      </div>

      <div v-if="model.vesselLines.length" class="item-tooltip__vessel">
        <p
          v-for="(line, index) in model.vesselLines"
          :key="`${line.section}-${index}-${line.text}`"
          :class="[
            `item-tooltip__line--${line.section}`,
            `item-tooltip__line--tone-${line.tone}`,
          ]"
          class="item-tooltip__line"
        >
          {{ line.text }}
        </p>
      </div>

      <section v-if="model.statLines.length" class="item-tooltip__stats">
        <span>Base profile</span>
        <p v-for="line in model.statLines" :key="line">{{ line }}</p>
      </section>

      <p v-if="model.binding" class="item-tooltip__binding">{{ model.binding }}</p>
      <p v-if="model.description" class="item-tooltip__description">{{ model.description }}</p>
    </aside>
  </Teleport>
</template>

<script>
import { buildItemTooltipModel } from '@/core/inventory/item-tooltip.js';

export default {
  name: 'ItemTooltip',
  props: {
    item: {
      type: Object,
      default: null,
    },
    dimensions: {
      type: Object,
      default: () => ({ width: 1, height: 1 }),
    },
    position: {
      type: Object,
      default: () => ({ left: 16, top: 16, bottom: null, maxHeight: 480 }),
    },
  },
  computed: {
    model() {
      return buildItemTooltipModel(this.item || {}, this.dimensions);
    },
    positionStyle() {
      return {
        left: `${this.position.left}px`,
        top: this.position.top === null ? 'auto' : `${this.position.top}px`,
        bottom: this.position.bottom === null ? 'auto' : `${this.position.bottom}px`,
        maxHeight: `${this.position.maxHeight}px`,
      };
    },
  },
};
</script>

<style lang="scss" scoped>
.item-tooltip {
  --rarity-color: #d8d2c2;

  position: fixed;
  z-index: 2400;
  box-sizing: border-box;
  width: min(326px, calc(100vw - 24px));
  overflow: hidden auto;
  color: #d7d1c2;
  background:
    linear-gradient(180deg, rgba(29, 31, 34, 0.98), rgba(8, 10, 12, 0.99)),
    radial-gradient(circle at 50% 0, color-mix(in srgb, var(--rarity-color) 18%, transparent), transparent 58%);
  border: 1px solid color-mix(in srgb, var(--rarity-color) 72%, #21190f);
  box-shadow:
    inset 0 0 0 1px rgba(255, 239, 198, 0.06),
    inset 0 0 34px rgba(0, 0, 0, 0.58),
    0 12px 32px rgba(0, 0, 0, 0.72);
  font: 0.7rem/1.4 'ChatFont', sans-serif;
  pointer-events: none;

  &--magic {
    --rarity-color: #75a7ef;
  }

  &--rare {
    --rarity-color: #e2bd59;
  }

  &--unique,
  &--awakened {
    --rarity-color: #d88442;
  }
}

.item-tooltip__header {
  padding: 11px 14px 10px;
  text-align: center;
  background: linear-gradient(180deg, color-mix(in srgb, var(--rarity-color) 17%, transparent), transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--rarity-color) 38%, transparent);

  span {
    display: block;
    margin-bottom: 3px;
    color: color-mix(in srgb, var(--rarity-color) 76%, #d8d2c2);
    font: 0.53rem 'GameFont', sans-serif;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  h3 {
    margin: 0;
    color: var(--rarity-color);
    font: 0.92rem/1.25 'GameFont', sans-serif;
    letter-spacing: 0.035em;
    text-shadow: 1px 1px 0 #000;
  }
}

.item-tooltip__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px 9px;
  padding: 7px 12px;
  color: rgba(215, 209, 194, 0.58);
  border-bottom: 1px solid rgba(215, 209, 194, 0.12);
  font-size: 0.6rem;
  text-transform: uppercase;

  span + span::before {
    margin-right: 9px;
    color: rgba(215, 209, 194, 0.22);
    content: '·';
  }

  strong {
    color: #d8c184;
    font-weight: normal;
  }
}

.item-tooltip__vessel,
.item-tooltip__stats {
  padding: 9px 14px;
  border-bottom: 1px solid rgba(215, 209, 194, 0.12);
}

.item-tooltip__line,
.item-tooltip__stats p {
  margin: 2px 0;
}

.item-tooltip__line--kind,
.item-tooltip__line--base,
.item-tooltip__line--vessel,
.item-tooltip__line--stat {
  text-align: center;
}

.item-tooltip__line--kind,
.item-tooltip__line--vessel {
  color: rgba(215, 209, 194, 0.68);
}

.item-tooltip__line--implicit {
  margin-top: 7px;
  padding-top: 7px;
  color: #79a8df;
  border-top: 1px solid rgba(117, 167, 239, 0.2);
  text-align: center;
}

.item-tooltip__line--brand {
  color: #77b9e8;
}

.item-tooltip__line--bond,
.item-tooltip__line--trophy,
.item-tooltip__line--tone-bond,
.item-tooltip__line--tone-bonus {
  color: #c19aef;
}

.item-tooltip__line--power,
.item-tooltip__line--tone-awakened {
  color: #efae68;
}

.item-tooltip__line--scar,
.item-tooltip__line--tone-estranged {
  color: #d27878;
}

.item-tooltip__line--flavor,
.item-tooltip__line--attune {
  margin-top: 7px;
  color: rgba(215, 209, 194, 0.52);
  font-style: italic;
}

.item-tooltip__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px 10px;

  > span {
    grid-column: 1 / -1;
    margin-bottom: 3px;
    color: rgba(215, 209, 194, 0.42);
    font: 0.52rem 'GameFont', sans-serif;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  p {
    color: rgba(215, 209, 194, 0.78);
  }
}

.item-tooltip__binding,
.item-tooltip__description {
  margin: 0;
  padding: 8px 14px;
  text-align: center;
}

.item-tooltip__binding {
  color: #d9bd78;
  background: rgba(101, 78, 27, 0.13);
  border-bottom: 1px solid rgba(217, 189, 120, 0.15);
}

.item-tooltip__description {
  color: rgba(215, 209, 194, 0.5);
  font-style: italic;
}
</style>
