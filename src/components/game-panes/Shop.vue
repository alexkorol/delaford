<template>
  <div class="shopView">
    <pane-header :text="data.name" />

    <header class="shop-counter">
      <div>
        <span>Your purse</span>
        <strong>{{ carriedCoins }} gold</strong>
      </div>
      <div v-if="data.type" class="shop-counter__type">
        <span>Stall</span>
        <strong>{{ stallLabel }}</strong>
      </div>
    </header>

    <p class="shopHint">
      Left-click stock to buy one. Right-click stock for quantities, or right-click
      a backpack item to sell it across the counter.
    </p>

    <item-grid
      :images="game.map.images"
      :items="data.inventory"
      :slots="44"
      screen="shop"
      primary-action="buy"
      @item-primary="trade"
    />

    <p class="shop-footnote">
      Coin spent at the bazaar stays at the bazaar. The Crossroads holds because it is worth walking to.
    </p>
  </div>
</template>

<script>
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
    carriedCoins() {
      const slots = this.game?.player?.inventory || [];
      return slots
        .filter(item => item && item.id === 'coins')
        .reduce((total, item) => total + Math.max(0, Math.floor(Number(item.qty) || 0)), 0);
    },
    stallLabel() {
      return this.data.type === 'speciality' ? 'Speciality goods' : 'General goods';
    },
  },
  methods: {
    trade({ action, item }) {
      if (!item?.id || action !== 'buy') return;
      Socket.emit('player:screen:npc:trade:action', {
        player: { socket_id: this.game.player.socket_id },
        doing: 'buy',
        item: {
          id: item.id,
          params: { quantity: 1 },
        },
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.shopView {
  height: 100%;
  padding: 5px;
  background: var(--panel-surface);
  font-family: "GameFont", sans-serif;
  border: 1px solid var(--color-frame-dark);
  outline: 1px solid var(--color-border-strong);
  outline-offset: -4px;
  box-shadow: var(--shadow-strong);

  .shop-counter {
    display: flex;
    justify-content: space-between;
    gap: 10px;
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

    &__type {
      text-align: right;
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

  .shopHint {
    margin: 0;
    padding: 9px 10px;
    background: var(--color-bg-inset);
    border-top: 1px solid var(--color-border-subtle);
    border-bottom: 1px solid var(--color-border-subtle);
    color: var(--color-text-secondary);
    font: .7rem/1.5 "ChatFont", sans-serif;
  }

  .shop-footnote {
    margin: 0;
    padding: 8px 10px;
    color: var(--color-text-dim);
    font: italic 0.62rem/1.5 'ChatFont', sans-serif;
  }

  .main {
    margin: 0 5px 5px;
  }
}
</style>
