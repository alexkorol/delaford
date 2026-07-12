<template>
  <div class="settings">
    <p class="settings__eyebrow">Display</p>
    <div class="settings__section">
      <div class="settings__section-heading">
        <label class="label" for="frame-rate">Frame rate cap</label>
        <output for="frame-rate">{{ fpsValue }} FPS</output>
      </div>
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
    </div>

    <p class="settings__eyebrow">Audio</p>
    <div class="settings__section">
      <label class="sound-toggle" for="sound-effects">
        <input
          id="sound-effects"
          v-model="selected.soundEffects"
          type="checkbox"
        >
        <span>
          <strong>Sound effects</strong>
          <small>Combat, loot, and world cues</small>
        </span>
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
  width: 100%;
  font-family: "GameFont", sans-serif;
  text-align: left;
  text-shadow: 0 1px 0 #000;
  font-size: 12px;

  .settings__eyebrow {
    margin: 0 0 7px;
    color: var(--color-accent);
    font-size: 0.62rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .settings__section {
    margin-bottom: 18px;
    padding: 14px;
    background: var(--color-bg-inset);
    border: 1px solid var(--color-border-subtle);
    box-shadow: inset 0 0 18px rgba(0, 0, 0, 0.42);
  }

  .settings__section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .label {
    display: block;
    color: var(--color-text-primary);
  }

  input[type="range"] {
    width: 100%;
    margin: 14px 0 7px;
    accent-color: var(--color-accent);
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
    color: var(--color-accent-strong);
    font-size: 0.72rem;
  }

  .sound-toggle {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;

    input {
      width: 18px;
      height: 18px;
      accent-color: var(--color-accent);
    }

    span {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    strong {
      color: var(--color-text-primary);
      font-weight: 500;
    }

    small {
      color: var(--color-text-dim);
      font: 0.72rem "ChatFont", sans-serif;
    }
  }
}
</style>
