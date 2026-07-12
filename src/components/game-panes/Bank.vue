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
@use 'sass:color';

$color: #706559;
$background_color: #ededed;
$default_color: #383838;

.bankView {
  background-color: $color;
  font-family: "GameFont", sans-serif;
  border: 5px solid color.adjust($color, $lightness: -10%);

  .house-transfer {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    align-items: center;
    padding: 10px;
    background: #332d27;
    color: #f4dfad;

    div {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    span,
    p {
      color: #c9b88f;
      font-size: .68rem;
    }

    strong {
      font-size: .82rem;
    }

    button {
      min-height: 32px;
      padding: 5px 9px;
      border: 1px solid #c9a85d;
      background: #665126;
      color: #fff2c8;
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
    padding: 7px 10px;
    background: #4a4239;
    color: #eee2c8;
    font-size: .7rem;
  }

  .header {
    background: color.adjust($color, $lightness: 10%);
    height: 30px;

    .close {
      float: right;
      width: 30px;
      box-sizing: border-box;
      height: 30px;
      background-color: color.adjust(red, $lightness: -10%);
      color: white;
      font-size: 1em;
      padding: 5px 2px 5px 5px;
    }
  }

  .main {
    padding: .5em;
  }
}
</style>
