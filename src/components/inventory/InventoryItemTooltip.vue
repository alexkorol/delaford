<template>
  <aside
    class="item-tooltip"
    :class="`item-tooltip--${rarity}`"
    :style="tooltipStyle"
    role="tooltip"
  >
    <header class="item-tooltip__header">
      <strong>{{ name }}</strong>
      <span>{{ subtitle }}</span>
    </header>

    <div class="item-tooltip__divider" />

    <p
      v-if="item.examine"
      class="item-tooltip__flavor"
    >
      {{ item.examine }}
    </p>

    <div
      v-if="combatLines.length"
      class="item-tooltip__combat"
    >
      <p
        v-for="line in combatLines"
        :key="line"
      >
        {{ line }}
      </p>
    </div>

    <section
      v-if="tooltipLines.length || vesselPips.length"
      class="item-tooltip__vessel"
    >
      <div class="item-tooltip__section-label">
        <span>Vessel</span>
        <span v-if="item.vessel?.material">{{ item.vessel.material }}</span>
      </div>

      <div
        v-if="vesselPips.length"
        class="item-tooltip__pips"
        aria-label="Vessel slots"
      >
        <span
          v-for="(pip, index) in vesselPips"
          :key="`${pip.kind}-${index}`"
          :class="`item-tooltip__pip--${pip.kind}`"
        >{{ pip.symbol }}</span>
      </div>

      <p
        v-for="(line, index) in tooltipLines"
        :key="`${line.section}-${index}`"
        :class="[
          'item-tooltip__line',
          `item-tooltip__line--${line.section}`,
          { 'item-tooltip__line--estranged': line.tone === 'estranged' },
        ]"
      >
        {{ line.text }}
      </p>
    </section>

    <div
      v-if="attunement"
      class="item-tooltip__attunement"
    >
      <div>
        <span>Attunement</span>
        <span>{{ attunement.current }} / {{ attunement.next }}</span>
      </div>
      <div class="item-tooltip__attunement-track">
        <span :style="{ width: `${attunement.percent}%` }" />
      </div>
    </div>

    <footer class="item-tooltip__footer">
      <span>{{ dimensions.width }} × {{ dimensions.height }}</span>
      <span v-if="item.boundTo">Bound</span>
      <span v-if="item.stackable && item.qty > 1">Stack {{ item.qty }}</span>
    </footer>
  </aside>
</template>

<script>
import { getItemDimensions } from '@/core/inventory/footprint.js';
import {
  getInventoryAttunement,
  getInventoryCombatLines,
  getInventoryItemName,
  getInventoryItemRarity,
  getInventoryTooltipLines,
  getInventoryVesselPips,
} from '@/core/inventory/item-presentation.js';

const TOOLTIP_WIDTH = 318;
const TOOLTIP_ESTIMATED_HEIGHT = 430;
const VIEWPORT_MARGIN = 12;
const POINTER_OFFSET = 18;

export default {
  name: 'InventoryItemTooltip',
  props: {
    item: {
      type: Object,
      required: true,
    },
    position: {
      type: Object,
      default: () => ({ x: 0, y: 0 }),
    },
  },
  computed: {
    name() {
      return getInventoryItemName(this.item);
    },
    rarity() {
      return getInventoryItemRarity(this.item);
    },
    subtitle() {
      const parts = [this.item.vessel?.form || this.item.type || 'Item'];
      if (this.item.vessel?.material) {
        parts.push(this.item.vessel.material);
      }
      if (Number.isFinite(this.item.vessel?.item?.ilvl)) {
        parts.push(`Level ${this.item.vessel.item.ilvl}`);
      }
      return parts.filter(Boolean).join(' · ');
    },
    dimensions() {
      return getItemDimensions(this.item, this.item.orientation);
    },
    combatLines() {
      return getInventoryCombatLines(this.item);
    },
    tooltipLines() {
      return getInventoryTooltipLines(this.item);
    },
    vesselPips() {
      return getInventoryVesselPips(this.item);
    },
    attunement() {
      return getInventoryAttunement(this.item);
    },
    tooltipStyle() {
      const viewportWidth = typeof window === 'undefined' ? 1920 : window.innerWidth;
      const viewportHeight = typeof window === 'undefined' ? 1080 : window.innerHeight;
      const pointerX = Number.isFinite(this.position?.x) ? this.position.x : 0;
      const pointerY = Number.isFinite(this.position?.y) ? this.position.y : 0;

      let left = pointerX + POINTER_OFFSET;
      if ((left + TOOLTIP_WIDTH + VIEWPORT_MARGIN) > viewportWidth) {
        left = pointerX - TOOLTIP_WIDTH - POINTER_OFFSET;
      }
      left = Math.max(VIEWPORT_MARGIN, left);

      let top = pointerY + POINTER_OFFSET;
      if ((top + TOOLTIP_ESTIMATED_HEIGHT + VIEWPORT_MARGIN) > viewportHeight) {
        top = Math.max(VIEWPORT_MARGIN, viewportHeight - TOOLTIP_ESTIMATED_HEIGHT - VIEWPORT_MARGIN);
      }

      return {
        left: `${left}px`,
        top: `${top}px`,
      };
    },
  },
};
</script>

<style lang="scss" scoped>
.item-tooltip {
  --tooltip-rarity: #d6d0c2;

  position: fixed;
  z-index: 1200;
  width: 318px;
  max-height: calc(100vh - 24px);
  padding: 20px 21px 16px;
  box-sizing: border-box;
  overflow-y: auto;
  pointer-events: none;
  color: #d6d0c2;
  background:
    radial-gradient(circle at 50% 0, rgba(95, 71, 31, 0.14), transparent 48%),
    #0d0c0a;
  border: 12px solid transparent;
  border-image: url('@/assets/inventory/frame_ornate.png') 118 / 12px stretch;
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.72);
  font-family: 'GameFont', sans-serif;
  font-size: 12px;
  line-height: 1.38;
  isolation: isolate;

  &--magic {
    --tooltip-rarity: #79aaf1;
  }

  &--rare {
    --tooltip-rarity: #e6c960;
  }

  &--unique {
    --tooltip-rarity: #ef8d43;
  }

  &__header {
    display: flex;
    flex-direction: column;
    gap: 3px;
    text-align: center;
  }

  &__header strong {
    color: var(--tooltip-rarity);
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 17px;
    font-weight: 600;
    line-height: 1.2;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95);
  }

  &__header span,
  &__section-label,
  &__footer {
    color: #777061;
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  &__divider {
    height: 18px;
    margin: 5px 0;
    opacity: 0.78;
    background: url('@/assets/inventory/divider.png') center / contain no-repeat;
  }

  &__flavor {
    margin: 0 0 8px;
    color: #aa9f87;
    font-style: italic;
    text-align: center;
  }

  &__combat {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding-bottom: 8px;
    color: #ddd5c5;
    border-bottom: 1px solid rgba(174, 147, 91, 0.16);
  }

  p {
    margin: 0;
  }

  &__vessel {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 8px;
  }

  &__section-label,
  &__footer,
  &__attunement > div:first-child {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  &__pips {
    display: flex;
    justify-content: center;
    gap: 4px;
    min-height: 17px;
    font-size: 15px;
  }

  &__pip--brand,
  &__line--brand {
    color: #dfb84e;
  }

  &__pip--bond,
  &__line--bond {
    color: #65b8a7;
  }

  &__pip--trophy,
  &__line--trophy {
    color: #b88bea;
  }

  &__pip--scar,
  &__line--scar {
    color: #9f5a5a;
  }

  &__pip--empty {
    color: #4b463d;
  }

  &__line--kind,
  &__line--vessel,
  &__line--base {
    color: #8d8575;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  &__line--implicit {
    color: #8fb7e8;
    font-style: italic;
  }

  &__line--power {
    color: #ef8d43;
  }

  &__line--flavor {
    color: #b7a98a;
    font-style: italic;
    text-align: center;
  }

  &__line--estranged {
    opacity: 0.55;
    font-style: italic;
  }

  &__attunement {
    margin-top: 9px;
    color: #8d8575;
    font-size: 10px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  &__attunement-track {
    height: 4px;
    margin-top: 4px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.65);
    border: 1px solid rgba(174, 147, 91, 0.15);
  }

  &__attunement-track span {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, #366a62, #77c6b4);
    box-shadow: 0 0 6px rgba(101, 184, 167, 0.45);
  }

  &__footer {
    margin-top: 9px;
    padding-top: 7px;
    border-top: 1px solid rgba(174, 147, 91, 0.16);
  }
}
</style>
