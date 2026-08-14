<template>
  <div class="bankView">
    <pane-header text="Bank of Delaford" />
    <section v-if="house" class="house-transfer" aria-label="House treasury transfer">
      <div>
        <span>Carried by this scion</span>
        <strong>{{ carriedCoins }} gold</strong>
      </div>
      <div>
        <span>House {{ house.name }} treasury</span>
        <strong>{{ house.treasury }} gold</strong>
      </div>
      <button type="button" :disabled="carriedCoins < 100" @click="deposit(100)">
        Deposit 100
      </button>
      <button type="button" :disabled="carriedCoins < 1" @click="deposit('all')">
        Deposit all
      </button>
      <p>House deposits are permanent and fund improvements between scion runs.</p>
    </section>
    <p class="bankHint">Personal storage — right-click backpack items to deposit or bank items to withdraw.</p>
    <item-grid
      :images="game.map.images"
      :items="bankItems"
      :slots="200"
      screen="bank"
    />
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
      default: () => ({}),
    },
  },
  data() {
    return {
      gameData: this.game.player.bank,
    };
  },
  computed: {
    bankItems() {
      return this.game.player.bank;
    },
    carriedCoins() {
      return Math.max(0, Number(this.data?.carriedCoins) || 0);
    },
    house() {
      return this.data?.house || null;
    },
  },
  mounted() {
    const INVENTORY = 1;
    bus.$emit('show-sidebar', INVENTORY);
  },
  methods: {
    deposit(amount) {
      Socket.emit('chronicles:house:deposit', { amount });
    },
  },
};
</script>

<style lang="scss" scoped>
.bankView {
  height: 100%;
  padding: 5px;
  background: var(--panel-surface);
  font-family: "GameFont", sans-serif;
  border: 1px solid var(--color-frame-dark);
  outline: 1px solid var(--color-border-strong);
  outline-offset: -4px;
  box-shadow: var(--shadow-strong);

  .house-transfer {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    align-items: center;
    margin: 0 5px;
    padding: 12px;
    background:
      linear-gradient(90deg, rgba(139, 48, 52, 0.1), transparent 46%, rgba(49, 91, 122, 0.08)),
      var(--color-bg-inset);
    border: 1px solid var(--color-border-subtle);
    color: var(--color-text-primary);

    div {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    span,
    p {
      color: var(--color-text-secondary);
      font-size: .68rem;
    }

    strong {
      font-size: .82rem;
      color: var(--color-accent-strong);
    }

    button {
      min-height: 32px;
      padding: 5px 9px;
      border: 1px solid var(--color-frame-dark);
      border-top-color: var(--color-bevel-light);
      background: var(--control-surface);
      color: var(--color-text-primary);
      cursor: pointer;
    }

    button:disabled {
      opacity: .45;
      cursor: default;
    }

    p {
      grid-column: 1 / -1;
      margin: 0;
    }
  }

  .bankHint {
    margin: 0;
    padding: 9px 10px;
    background: rgba(6, 7, 8, 0.68);
    border-top: 1px solid var(--color-border-subtle);
    border-bottom: 1px solid var(--color-border-subtle);
    color: var(--color-text-secondary);
    font-size: .7rem;
  }

  .main {
    margin: 0 5px 5px;
  }
}
</style>
