<template>
  <div class="settings">
    <h2>Settings</h2>
    <div class="section">
      <label class="label" for="frame-rate">Frame rate cap</label>
      <div class="range">
        <input
          id="frame-rate"
          v-model="selected.fps"
          type="range"
          min="1"
          max="5"
          step="1"
          value="1"
        >
      </div>

      <div class="fps-range">
        <div>20</div>
        <div>30</div>
        <div>40</div>
        <div>50</div>
        <div>60</div>
      </div>
      <output for="frame-rate">{{ fpsValue }} FPS</output>
    </div>

    <div class="section">
      <label class="sound-toggle" for="sound-effects">
        <input
          id="sound-effects"
          v-model="selected.soundEffects"
          type="checkbox"
        >
        Sound effects
      </label>
    </div>
  </div>
</template>

<script>
import { mapStores } from 'pinia';

import { useUiStore } from '@/stores/ui.js';
import bus from '../../core/utilities/bus.js';

export default {
  data() {
    return {
      selected: {
        fps: 5,
        soundEffects: true,
      },
      fps: [null, 20, 30, 40, 50, 60],
    };
  },
  computed: {
    ...mapStores(useUiStore),
    fpsValue() {
      return this.fps[this.selected.fps];
    },
  },
  created() {
    const storedFpsIndex = this.fps.indexOf(Number(this.uiStore.settings?.fps));
    this.selected.fps = storedFpsIndex > 0 ? storedFpsIndex : 5;
    this.selected.soundEffects = this.uiStore.settings?.soundEffects !== false;
  },
  watch: {
    'selected.fps': {
      handler() {
        bus.$emit('SETTINGS:FPS', this.fpsValue);
        this.persistSettings();
      },
      deep: true,
    },
    'selected.soundEffects': {
      handler(enabled) {
        bus.$emit('SETTINGS:SOUND', enabled);
        this.persistSettings();
      },
    },
  },
  methods: {
    persistSettings() {
      this.uiStore.setSettings({
        fps: this.fpsValue,
        soundEffects: this.selected.soundEffects,
      });
    },
  },
};
</script>

<style lang="scss" scoped>
div.settings {
  height: 100%;
  font-family: "GameFont", sans-serif;
  text-align: left;
  text-shadow: 1px 1px 0 black;
  font-size: 12px;

  h2 {
    margin: 0 0 1rem;
    font-size: 1rem;
  }

  .section + .section {
    margin-top: 1.25rem;
  }

  .label {
    display: block;
    margin-bottom: 0.5em;
  }

  input[type="range"] {
    width: 100%;
  }

  div.fps-range {
    width: 100%;
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 10px;
    display: inline-flex;
    justify-content: space-between;

    div {
      display: inline;
      margin: 0;
      padding: 0;
    }
  }

  output {
    display: block;
    margin-top: 0.5rem;
    color: #e8cd83;
  }

  .sound-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }
}
</style>
