<template>
  <div class="shopView">
    <pane-header :text="data.name" />
    <p class="shopHint">Right-click an item to buy. Right-click your backpack to sell.</p>
    <item-grid
      :images="game.map.images"
      :items="data.inventory"
      :slots="44"
      screen="shop"
    />
  </div>
</template>

<script>
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
};
</script>

<style lang="scss" scoped>
@use 'sass:color';

$color: #706559;
$background_color: #ededed;
$default_color: #383838;

.shopView {
  background-color: $color;
  font-family: "GameFont", sans-serif;
  border: 5px solid color.adjust($color, $lightness: -10%);

  .shopHint {
    margin: 0;
    padding: 8px 10px;
    background: #332d27;
    color: #f4dfad;
    font-size: .75rem;
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
