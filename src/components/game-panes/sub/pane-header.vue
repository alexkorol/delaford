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
.header {
  display: flex;
  align-items: center;
  min-height: 40px;
  padding: 0 14px;
  background: var(--panel-header);
  border-bottom: 1px solid var(--color-border-strong);
  position: relative;

  .text-header {
    cursor: default;
    color: var(--color-accent-strong);
    text-shadow: 0 2px 0 #000;
    font-size: 0.74rem;
    letter-spacing: 0.1em;
    line-height: 1;
    text-transform: uppercase;
  }
}
</style>
