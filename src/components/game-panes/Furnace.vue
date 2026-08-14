<template>
  <div class="furnaceView">
    <pane-header text="Furnace" />
    <p>
      Select the bar you want to smelt
    </p>
    <item-grid
      :images="game.map.images"
      :items="barItems"
      :slots="6"
      class="furnaceGrid"
      screen="furnace"
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
      smithingLevel: this.game.player.skills.smithing.level,
    };
  },
  computed: {
    itemDetail() {
      return {
        'bronze-bar': 1,
        'iron-bar': 19,
        'silver-bar': 25,
        'steel-bar': 40,
        'gold-bar': 47,
        'jatite-bar': 55,
      };
    },
    barItems() {
      return this.data.items.map((e, index) => ({
        qty: 1,
        slot: index,
        id: e,
        isLocked: this.itemDetail[e] <= this.smithingLevel ? '' : 'locked-item',
      }));
    },
  },
};
</script>

<style lang="scss" scoped>
p {
  margin: 0;
  padding: 12px;
  color: var(--color-text-secondary);
  font: .72rem "ChatFont", sans-serif;
}

.furnaceGrid {
  display: flex;
  justify-content: center;
  height: auto;
}

.furnaceView {
  height: 100%;
  padding: 5px;
  background: var(--panel-surface);
  font-family: "GameFont", sans-serif;
  border: 1px solid var(--color-frame-dark);
  outline: 1px solid var(--color-border-strong);
  outline-offset: -4px;
  box-shadow: var(--shadow-strong);

  .main {
    margin: 0 5px 5px;
  }
}
</style>
