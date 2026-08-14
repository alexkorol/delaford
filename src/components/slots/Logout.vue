<template>
  <section class="logout-confirm">
    <div class="logout-confirm__sigil" aria-hidden="true">V</div>
    <p class="logout-confirm__eyebrow">End this session</p>
    <h2>Return to the Chronicles?</h2>
    <p class="logout-confirm__copy">
      Your scion, inventory, House progress, and current build will be written before you leave.
    </p>
    <button
      class="button logout-confirm__action"
      type="button"
      @click="logout"
    >
      Save and log out
    </button>
  </section>
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
  },
  methods: {
    logout() {
      Socket.emit('player:logout', { id: this.game.player.socket_id });
      bus.$emit('player:logout');
    },
  },
};
</script>

<style lang="scss" scoped>
.logout-confirm {
  display: flex;
  align-items: center;
  flex-direction: column;
  width: 100%;
  padding: 10px 18px 14px;
  color: var(--color-text-primary);
  text-align: center;

  &__sigil {
    display: grid;
    place-items: center;
    width: 54px;
    height: 54px;
    margin-bottom: 12px;
    color: var(--color-accent-strong);
    background:
      radial-gradient(circle, rgba(139, 48, 52, 0.5), transparent 58%),
      #111214;
    border: 1px solid var(--color-frame-light);
    outline: 1px solid #1d130b;
    outline-offset: 3px;
    font: 1.4rem "GameFont", sans-serif;
    transform: rotate(45deg);
    box-shadow: 0 0 22px rgba(139, 48, 52, 0.24);

    &::first-letter {
      transform: rotate(-45deg);
    }
  }

  &__eyebrow {
    margin: 0 0 5px;
    color: #a9615e;
    font-size: 0.65rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    color: var(--color-accent-strong);
    font-size: clamp(1.05rem, 3vw, 1.35rem);
    font-weight: 500;
    letter-spacing: 0.04em;
    text-shadow: 0 2px 0 #000;
  }

  &__copy {
    max-width: 430px;
    margin: 14px 0 20px;
    color: var(--color-text-secondary);
    font: 0.82rem/1.65 "ChatFont", sans-serif;
    text-shadow: 0 1px 0 #000;
  }

  &__action {
    width: min(310px, 100%);
    border-color: #54211f;
    color: #f1c4b7;
    background:
      linear-gradient(180deg, rgba(143, 53, 49, 0.72), rgba(59, 24, 24, 0.92)),
      #261313;

    &:hover,
    &:focus-visible {
      color: #ffe0cf;
      border-color: #b55e52;
      background: linear-gradient(180deg, #7d3832, #321818);
    }
  }
}
</style>
