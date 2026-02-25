<template>
  <div
    v-if="player"
    class="info"
  >
    <span v-text="player.username" />

    <div
      v-if="hp"
      class="health"
      role="progressbar"
      :aria-valuenow="hp.current"
      :aria-valuemin="0"
      :aria-valuemax="hp.max"
      aria-label="Health"
    >
      <div
        :style="displayHealthPercentage"
        class="bar"
      >
        <div>{{ `${hp.current} / ${hp.max}` }}</div>
      </div>
    </div>

    <div class="stats">
      <div class="level">
        <strong>Lvl:</strong> <span
          class="integer"
          v-text="player.level"
        />
      </div>
      <div class="att_def">
        <!-- Should anything go here? -->
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    game: {
      type: Object,
      required: true,
    },
  },
  computed: {
    player() {
      return this.game.player;
    },
    hp() {
      const hpData = this.game.player && this.game.player.hp;
      if (!hpData) {
        return null;
      }
      return {
        current: hpData.current || 0,
        max: hpData.max || 0,
      };
    },
    getHealthPercentage() {
      if (!this.hp || !this.hp.max) {
        return 0;
      }
      return (this.hp.current / this.hp.max) * 100;
    },
    getAttack() {
      const combat = this.game.player && this.game.player.combat;
      return combat ? combat.attack : 0;
    },
    getDefence() {
      const combat = this.game.player && this.game.player.combat;
      return combat ? combat.defense : 0;
    },
    displayHealthPercentage() {
      return `width:${this.getHealthPercentage}%`;
    },
  },
};
</script>

<style lang="scss" scoped>
@use 'sass:color';

$info_text_color: rgb(68, 68, 68);
$health_bg: #c62828;
$health_fill: #558b2f;

div.info {
  margin-bottom: auto;
  font-family: "GameFont", sans-serif;
  text-align: left;
  padding: 0 0 0 5px;
  color: $info_text_color;

  span.username {
    font-size: 15px;
  }

  .health {
    margin-top: 0.5em;
    width: 100%;
    box-sizing: border-box;
    border: 2px solid #525252;
    background: $health_bg;
    height: 20px;
    border-radius: 2px;
    overflow: hidden;

    .bar {
      height: 100%;
      background: $health_fill;
      transition: width 0.25s ease-out;

      div {
        font-size: 10px;
        color: white;
        padding: 2px 0 0 4px;
        white-space: nowrap;
      }
    }
  }

  .stats {
    display: flex;
    justify-content: space-between;
    align-items: baseline;

    strong {
      font-weight: bold;
    }

    .level,
    .att_def {
      margin-top: 0.5em;
      font-size: 12px;

      .def_label {
        margin-left: 0.5em;
      }
    }

    span.integer {
      color: color.adjust($info_text_color, $lightness: 15%);
      margin-left: 0.5em;
    }
  }
}
</style>
