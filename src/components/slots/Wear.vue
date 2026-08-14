<template>
  <EquipmentRagdoll :game="game" class="wear-pane" />
</template>

<script>
import EquipmentRagdoll from '../inventory/EquipmentRagdoll.vue';

export default {
  name: 'WearPane',
  components: {
    EquipmentRagdoll,
  },
  props: {
    game: {
      type: Object,
      required: true,
    },
  },
};
</script>

<style scoped>
.wear-pane {
  width: 100%;
}
</style>
