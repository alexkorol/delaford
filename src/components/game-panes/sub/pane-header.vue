<template>
  <div class="header">
    <div
      class="text-header"
      v-text="text"
    />
  </div>
</template>

<script>
export default {
  props: {
    text: {
      type: String,
      required: true,
    },
  },
};
</script>

<style lang="scss" scoped>
@use 'sass:color';

$color: #706559;

.header {
  background: color.adjust($color, $lightness: 10%);
  height: 30px;
  position: relative;

  .text-header {
    cursor: default;
    text-shadow: 2px 2px 0 black;
    line-height: 27px;
  }

}
</style>
