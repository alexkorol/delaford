<template>
  <div class="wagonView">
    <pane-header :text="`House ${house.name} — Wagon`" />

    <header class="wagon-standing">
      <div>
        <span>Standing on the road</span>
        <strong>{{ house.rank }}</strong>
      </div>
      <div>
        <span>Renown</span>
        <strong>{{ house.renown }}</strong>
      </div>
      <div>
        <span>Deepest chart</span>
        <strong>{{ house.bestDepth || '—' }}</strong>
      </div>
    </header>

    <div class="wagon-scroll">
      <!-- The road purse -->
      <section class="wagon-section" aria-label="Road purse">
        <h3>Road purse</h3>
        <div v-if="house.dailyClaimAvailable" class="wagon-purse">
          <p>The wagon rolled in with the dawn market. Today's purse is {{ house.dailyGold }} gold.</p>
          <button type="button" @click="claimDaily">Count it into the ledger</button>
        </div>
        <p v-else class="wagon-note">Today's purse is already in the ledger. The wagon rolls in again at dawn.</p>
      </section>

      <!-- The ledger -->
      <section class="wagon-section" aria-label="House ledger">
        <h3>Ledger</h3>
        <div class="wagon-ledger">
          <div>
            <span>In the ledger-chest</span>
            <strong>{{ house.treasury }} gold</strong>
          </div>
          <div>
            <span>Carried by {{ scionName }}</span>
            <strong>{{ carriedCoins }} gold</strong>
          </div>
          <div class="wagon-ledger__actions">
            <button type="button" :disabled="carriedCoins < 100" @click="deposit(100)">
              Nail down 100
            </button>
            <button type="button" :disabled="carriedCoins < 1" @click="deposit('all')">
              Nail down all
            </button>
          </div>
        </div>
        <p class="wagon-note">
          Gold under the boards goes home to the House. It outlives the hand that earned it.
        </p>
      </section>

      <!-- The stores chest -->
      <section class="wagon-section" aria-label="Stores chest">
        <h3>Stores chest</h3>
        <div
          v-for="tier in data.stock"
          :key="tier.tier"
          class="wagon-tier"
        >
          <header class="wagon-tier__head">
            <span class="wagon-tier__label">{{ tier.label }}</span>
            <span v-if="!tier.unlocked" class="wagon-tier__lock">needs {{ tier.requirement }}</span>
          </header>
          <ul v-if="tier.unlocked" class="wagon-stock">
            <li
              v-for="item in tier.items"
              :key="item.id"
              class="wagon-stock__row"
            >
              <span class="wagon-stock__icon" :style="iconStyle(item.id)" />
              <span class="wagon-stock__name">{{ item.name }}</span>
              <span class="wagon-stock__price">{{ Math.max(1, item.price) }}g</span>
              <button
                type="button"
                :disabled="house.treasury < Math.max(1, item.price)"
                @click="outfit(item)"
              >
                Outfit
              </button>
            </li>
          </ul>
        </div>
        <p class="wagon-note">The House outfits its own — the ledger pays, not your purse.</p>
      </section>

      <!-- Improvements -->
      <section class="wagon-section" aria-label="House improvements">
        <h3>Improvements</h3>
        <ul class="wagon-upgrades">
          <li
            v-for="upgrade in upgradeRows"
            :key="upgrade.id"
            class="wagon-upgrades__row"
          >
            <span class="wagon-upgrades__name">{{ upgrade.label }}</span>
            <span class="wagon-upgrades__level">{{ upgrade.level }}/{{ upgrade.maxLevel }}</span>
            <button
              v-if="upgrade.level < upgrade.maxLevel"
              type="button"
              :disabled="house.treasury < upgrade.cost"
              @click="buyUpgrade(upgrade)"
            >
              Raise — {{ upgrade.cost }}g
            </button>
            <span v-else class="wagon-upgrades__done">complete</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script>
import UI from '@shared/ui.js';
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
    house() {
      return this.data.house || {};
    },
    carriedCoins() {
      return Math.max(0, Number(this.data.carriedCoins) || 0);
    },
    scionName() {
      return this.game?.player?.username || 'this scion';
    },
    upgradeRows() {
      const definitions = this.data.houseUpgrades || {};
      const levels = this.house.upgrades || {};
      return Object.entries(definitions).map(([id, definition]) => {
        const level = Math.max(0, Number(levels[id]) || 0);
        return {
          id,
          label: definition.label,
          level,
          maxLevel: definition.maxLevel,
          cost: definition.baseCost * (level + 1),
        };
      });
    },
  },
  mounted() {
    const INVENTORY = 1;
    bus.$emit('show-sidebar', INVENTORY);
  },
  methods: {
    iconStyle(id) {
      const definition = UI.getItemData(id);
      const images = this.game?.map?.images;
      if (!definition?.graphics || !images) return {};
      const sheet = {
        general: images.generalImage,
        jewelry: images.jewelryImage,
        armor: images.armorImage,
        weapons: images.weaponsImage,
      }[definition.graphics.tileset] || images.weaponsImage;
      if (!sheet?.src) return {};
      return {
        backgroundImage: `url(${sheet.src})`,
        backgroundPosition: `left -${definition.graphics.column * 32}px top -${definition.graphics.row * 32}px`,
      };
    },
    deposit(amount) {
      Socket.emit('chronicles:house:deposit', { amount });
    },
    claimDaily() {
      Socket.emit('wagon:daily:claim', {});
    },
    outfit(item) {
      Socket.emit('wagon:outfit:buy', { itemId: item.id });
    },
    buyUpgrade(upgrade) {
      Socket.emit('wagon:upgrade', { upgradeId: upgrade.id });
    },
  },
};
</script>

<style lang="scss" scoped>
.wagonView {
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

  button {
    flex: 0 0 auto;
    min-height: 28px;
    padding: 4px 10px;
    border: 1px solid var(--color-frame-dark);
    border-top-color: var(--color-bevel-light);
    background: var(--control-surface);
    color: var(--color-text-primary);
    font-family: 'GameFont', sans-serif;
    font-size: 0.68rem;
    cursor: pointer;

    &:disabled {
      opacity: 0.45;
      cursor: default;
    }

    &:hover:not(:disabled) {
      background: var(--control-surface-hover);
      color: #fff0c2;
    }
  }

  .wagon-standing {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 0 5px;
    padding: 10px 12px;
    background:
      linear-gradient(90deg, rgba(139, 48, 52, 0.1), transparent 46%, rgba(49, 91, 122, 0.08)),
      var(--color-bg-inset);
    border: 1px solid var(--color-border-subtle);

    div {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    span {
      color: var(--color-text-secondary);
      font-size: 0.62rem;
    }

    strong {
      color: var(--color-accent-strong);
      font-size: 0.8rem;
    }
  }

  .wagon-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    margin: 5px 5px 0;
    padding-bottom: 6px;

    &::-webkit-scrollbar { width: 8px; }
    &::-webkit-scrollbar-thumb { background-color: rgba(183, 146, 79, 0.46); }
    &::-webkit-scrollbar-track { background-color: transparent; }
  }

  .wagon-section {
    margin-top: 6px;
    padding: 8px 10px 10px;
    background: var(--color-bg-inset);
    border: 1px solid var(--color-border-subtle);

    h3 {
      margin: 0 0 7px;
      color: var(--color-text-dim);
      font-size: 0.64rem;
      font-weight: normal;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
  }

  .wagon-purse {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;

    p {
      margin: 0;
      color: var(--color-accent-strong);
      font-size: 0.72rem;
      line-height: 1.45;
    }
  }

  .wagon-note {
    margin: 7px 0 0;
    color: var(--color-text-secondary);
    font: italic 0.64rem/1.5 'ChatFont', sans-serif;
  }

  .wagon-ledger {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    align-items: center;

    div {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    span {
      color: var(--color-text-secondary);
      font-size: 0.64rem;
    }

    strong {
      color: var(--color-accent-strong);
      font-size: 0.8rem;
    }

    &__actions {
      grid-column: 1 / -1;
      flex-direction: row !important;
      gap: 8px !important;
    }
  }

  .wagon-tier {
    margin-bottom: 6px;

    &__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
      padding: 3px 0;
      border-bottom: 1px solid rgba(183, 146, 79, 0.2);
    }

    &__label {
      color: var(--color-text-primary);
      font-size: 0.72rem;
    }

    &__lock {
      color: var(--color-text-dim);
      font: italic 0.62rem 'ChatFont', sans-serif;
    }
  }

  .wagon-stock {
    margin: 4px 0 0;
    padding: 0;
    list-style: none;

    &__row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 3px 2px;

      &:nth-child(odd) {
        background: rgba(255, 255, 255, 0.02);
      }
    }

    &__icon {
      flex: 0 0 32px;
      width: 32px;
      height: 32px;
      box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(130, 105, 62, 0.24);
    }

    &__name {
      flex: 1 1 auto;
      color: var(--color-text-primary);
      font-size: 0.72rem;
    }

    &__price {
      flex: 0 0 auto;
      color: var(--color-accent-strong);
      font-size: 0.7rem;
    }
  }

  .wagon-upgrades {
    margin: 0;
    padding: 0;
    list-style: none;

    &__row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 2px;

      &:nth-child(odd) {
        background: rgba(255, 255, 255, 0.02);
      }
    }

    &__name {
      flex: 1 1 auto;
      color: var(--color-text-primary);
      font-size: 0.72rem;
    }

    &__level {
      color: rgba(148, 180, 214, 0.86);
      font-size: 0.66rem;
    }

    &__done {
      color: #79c07a;
      font-size: 0.64rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
  }
}
</style>
