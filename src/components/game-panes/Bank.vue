<template>
  <div class="bankView">
    <pane-header text="Bank of Delaford" />
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

export default {
  props: {
    game: {
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
  mounted() {
    const INVENTORY = 1;
    bus.$emit('show-sidebar', INVENTORY);
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
