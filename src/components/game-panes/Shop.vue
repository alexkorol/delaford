<template>
  <div class="shopView">
    <pane-header :text="data.name" />
    <p class="shopHint">
      Left-click stock to buy one. Right-click stock for quantities or a backpack item to sell.
    </p>
    <item-grid
      :images="game.map.images"
      :items="data.inventory"
      :slots="44"
      screen="shop"
      primary-action="buy"
      @item-primary="trade"
    />
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
  data() {
    return {
      gameData: this.game.player.bank,
    };
  },
  computed: {
    bankItems() {
      return this.game.player.bank;
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

  .shopHint {
    margin: 0;
    padding: 10px;
    background: var(--color-bg-inset);
    border-top: 1px solid var(--color-border-subtle);
    border-bottom: 1px solid var(--color-border-subtle);
    color: var(--color-text-secondary);
    font: .72rem/1.5 "ChatFont", sans-serif;
  }

  .main {
    margin: 0 5px 5px;
  }
}
</style>
