<template>
  <div class="anvilView">
    <pane-header text="Anvil" />
    <p>What would you like to make?</p>
    <anvil-grid
      :images="game.map.images"
      :items="smeltItems"
      :slots="6"
      class="anvilGrid"
      screen="anvil"
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
    barToForge() {
      return this.data.bar;
    },
    barsInInventory() {
      return this.game.player.inventory.filter(
        (item) => item.id === `${this.barToForge}-bar`,
      ).length;
    },
    smeltItems() {
      return this.data.items.map((e, index) => ({
        qty: 1,
        slot: index,
        id: e.item,
        levelNeeded: e.level,
        barsNeeded: e.bars,
        hasBars: e.bars <= this.barsInInventory,
        hasLevel: e.level <= this.smithingLevel,
        isLocked: e.level <= this.smithingLevel ? '' : 'locked-item',
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

.anvilGrid {
  display: flex;
  justify-content: center;
  height: auto;
}

.anvilView {
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
