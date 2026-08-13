<template>
  <section class="chronicles" aria-labelledby="chronicles-title">
    <header class="chronicles__header">
      <div class="chronicles__sigil" aria-hidden="true"><span>V</span></div>
      <div>
        <p class="chronicles__eyebrow">The living record</p>
        <h1 id="chronicles-title">Chronicles</h1>
        <p class="chronicles__account">
          {{ accountName ? `Account: ${accountName}` : 'Authenticated account' }}
        </p>
      </div>
    </header>

    <p class="chronicles__intro">
      Your House endures beyond any one adventurer. Name its first Scion, then set out into Delaford.
    </p>

    <form
      v-if="!activeHouse || foundingHouse"
      class="chronicles__founding"
      @submit.prevent="createHouse"
    >
      <label for="chronicles-house-name">Found a House</label>
      <div class="chronicles__input-row">
        <input
          id="chronicles-house-name"
          ref="houseNameInput"
          v-model="houseName"
          type="text"
          minlength="3"
          maxlength="20"
          autocomplete="off"
          placeholder="House name"
        >
        <button type="submit">Inscribe</button>
      </div>
      <button
        v-if="activeHouse"
        class="chronicles__text-button"
        type="button"
        @click="foundingHouse = false"
      >
        Return to {{ activeHouse.name }}
      </button>
    </form>

    <div v-else class="chronicles__ledger">
      <aside class="chronicles__houses" aria-label="Houses">
        <p class="chronicles__section-label">House records</p>
        <button
          v-for="house in state.houses"
          :key="house.id"
          class="chronicles__house-tab"
          :class="{ 'chronicles__house-tab--active': house.id === activeHouse.id }"
          type="button"
          @click="chooseHouse(house.id)"
        >
          <span>House {{ house.name }}</span>
          <small>{{ house.scions.length }} living · {{ house.crypt.length }} fallen</small>
        </button>
        <button
          class="chronicles__text-button chronicles__text-button--new"
          type="button"
          @click="beginFounding"
        >
          + Found another House
        </button>
      </aside>

      <div class="chronicles__house">
        <div class="chronicles__house-heading">
          <div>
            <p class="chronicles__eyebrow">House of</p>
            <h2>{{ activeHouse.name }}</h2>
          </div>
          <dl>
            <div><dt>Renown</dt><dd>{{ activeHouse.renown }}</dd></div>
            <div><dt>Crypt</dt><dd>{{ activeHouse.crypt.length }}</dd></div>
          </dl>
        </div>

        <div class="chronicles__roster">
          <p class="chronicles__section-label">Living Scions</p>
          <p v-if="!activeHouse.scions.length" class="chronicles__empty">
            No living names are written here yet.
          </p>
          <button
            v-for="scion in activeHouse.scions"
            :key="scion.id"
            class="chronicles__scion"
            :class="{ 'chronicles__scion--active': scion.id === activeScion?.id }"
            type="button"
            @click="chooseScion(scion.id)"
          >
            <span class="chronicles__portrait" :style="portraitStyle" aria-hidden="true"></span>
            <span class="chronicles__scion-copy">
              <strong>{{ scion.name }}</strong>
              <small>
                Level {{ scion.level }} · {{ scion.mortal ? 'Mortal oath' : 'Soft return' }}
              </small>
            </span>
            <span class="chronicles__selection" aria-hidden="true">
              {{ scion.id === activeScion?.id ? '◆' : '◇' }}
            </span>
          </button>
        </div>

        <form class="chronicles__scion-form" @submit.prevent="createScion">
          <label for="chronicles-scion-name">Name a new Scion</label>
          <div class="chronicles__input-row">
            <input
              id="chronicles-scion-name"
              v-model="scionName"
              type="text"
              minlength="2"
              maxlength="20"
              autocomplete="off"
              placeholder="Scion name"
            >
            <button type="submit">Add Scion</button>
          </div>
          <label class="chronicles__mortal-option">
            <input v-model="mortalScion" class="chronicles__mortal-checkbox" type="checkbox">
            <span>
              <strong>Swear the mortal oath</strong>
              <small>Final death moves this Scion to the crypt. Off by default while balance is still being tuned.</small>
            </span>
          </label>
        </form>

        <details v-if="activeHouse.crypt.length" class="chronicles__crypt">
          <summary>Open the crypt ({{ activeHouse.crypt.length }})</summary>
          <ul>
            <li v-for="scion in activeHouse.crypt" :key="scion.id">
              {{ scion.name }}, level {{ scion.level }}
            </li>
          </ul>
        </details>

        <button
          class="chronicles__set-out"
          type="button"
          :disabled="!activeScion || submitting"
          @click="setOut"
        >
          {{ submitting ? 'Opening the way…' : activeScion ? `Set Out as ${activeScion.name}` : 'Choose a Scion' }}
        </button>
      </div>
    </div>

    <p v-if="error" class="chronicles__error" role="alert">{{ error }}</p>
  </section>
</template>

<script>
import playerSheet from '@/assets/graphics/actors/players/human-v2.png';
import bus from '@/core/utilities/bus.js';
import {
  addScion,
  foundHouse,
  getActiveHouse,
  getActiveScion,
  loadHouses,
  saveHouses,
  selectHouse,
  selectScion,
} from '@/core/chronicles/houses.js';

export default {
  name: 'ChroniclesScreen',
  props: {
    accountName: {
      type: String,
      default: '',
    },
  },
  emits: ['set-out'],
  data() {
    return {
      state: loadHouses(),
      houseName: '',
      scionName: '',
      mortalScion: false,
      foundingHouse: false,
      submitting: false,
      error: '',
    };
  },
  computed: {
    activeHouse() {
      return getActiveHouse(this.state);
    },
    activeScion() {
      return getActiveScion(this.state);
    },
    portraitStyle() {
      return { backgroundImage: `url(${playerSheet})` };
    },
  },
  mounted() {
    bus.$on('player:chronicles:error', this.handleServerError);
  },
  beforeUnmount() {
    bus.$off('player:chronicles:error', this.handleServerError);
  },
  methods: {
    persist(nextState) {
      this.state = nextState;
      if (!saveHouses(nextState)) {
        this.error = 'This browser could not save the Chronicles. Check local storage permissions.';
        return false;
      }
      return true;
    },
    createHouse() {
      this.error = '';
      const result = foundHouse(this.state, this.houseName);
      if (!result.ok) {
        this.error = result.reason;
        return;
      }
      this.persist(result.state);
      this.houseName = '';
      this.foundingHouse = false;
    },
    beginFounding() {
      this.error = '';
      this.foundingHouse = true;
      this.$nextTick(() => this.$refs.houseNameInput?.focus());
    },
    chooseHouse(houseId) {
      this.error = '';
      const result = selectHouse(this.state, houseId);
      if (result.ok) {
        this.persist(result.state);
      }
    },
    createScion() {
      this.error = '';
      const result = addScion(this.state, this.activeHouse?.id, this.scionName, {
        mortal: this.mortalScion,
      });
      if (!result.ok) {
        this.error = result.reason;
        return;
      }
      this.persist(result.state);
      this.scionName = '';
      this.mortalScion = false;
    },
    chooseScion(scionId) {
      this.error = '';
      const result = selectScion(this.state, scionId);
      if (result.ok) {
        this.persist(result.state);
      }
    },
    setOut() {
      if (!this.activeScion || this.submitting) {
        return;
      }
      this.error = '';
      this.submitting = true;
      this.$emit('set-out', {
        ...this.activeScion,
        houseId: this.activeHouse.id,
        houseName: this.activeHouse.name,
      });
    },
    handleServerError(payload = {}) {
      this.submitting = false;
      this.error = payload.message || 'The way into Delaford could not be opened.';
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/assets/scss/abstracts/tokens' as *;

.chronicles {
  color: #e9ddc5;
}

.chronicles__header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid rgba(95, 168, 147, 0.4);

  h1 {
    margin: 0;
    color: #f0d486;
    font-family: 'GameFont', sans-serif;
    font-size: clamp(1.7rem, 5vw, 2.45rem);
    font-weight: normal;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
}

.chronicles__sigil {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  flex: 0 0 auto;
  color: #8bd2bc;
  font-size: 1.45rem;
  border: 1px solid #5fa893;
  outline: 1px solid rgba(212, 173, 90, 0.45);
  outline-offset: 4px;
  transform: rotate(45deg);

  span {
    display: block;
    transform: rotate(-45deg);
  }
}

.chronicles__eyebrow,
.chronicles__section-label {
  margin: 0 0 3px;
  color: #78bba7;
  font-family: 'ChatFont', sans-serif;
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.chronicles__account {
  margin: 2px 0 0;
  color: rgba(233, 221, 197, 0.58);
  font-family: 'ChatFont', sans-serif;
  font-size: 0.72rem;
}

.chronicles__intro {
  margin: var(--space-md) 0;
  color: rgba(233, 221, 197, 0.72);
  font-family: 'ChatFont', sans-serif;
  font-size: 0.82rem;
  line-height: 1.45;
}

.chronicles__founding {
  display: grid;
  gap: var(--space-sm);
  max-width: 440px;
  margin: var(--space-xl) auto;
  padding: var(--space-xl);
  background: rgba(10, 8, 6, 0.58);
  border: 1px solid rgba(212, 173, 90, 0.32);

  > label {
    color: #f0d486;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
}

.chronicles__input-row {
  display: flex;
  gap: var(--space-xs);

  input {
    min-width: 0;
    flex: 1;
    box-sizing: border-box;
    padding: 9px 10px;
    color: #fff6df;
    font: 0.82rem 'ChatFont', sans-serif;
    background: #0d0b09;
    border: 1px solid #5d513e;

    &:focus {
      border-color: #5fa893;
      outline: 1px solid rgba(95, 168, 147, 0.45);
    }
  }

  button {
    padding: 8px 13px;
    color: #f7eeda;
    font-family: 'GameFont', sans-serif;
    background: linear-gradient(#705f40, #463821);
    border: 1px solid #b49558;
    cursor: pointer;
  }
}

.chronicles__ledger {
  display: grid;
  grid-template-columns: minmax(145px, 0.72fr) minmax(0, 1.6fr);
  gap: var(--space-md);
}

.chronicles__houses {
  padding-right: var(--space-md);
  border-right: 1px solid rgba(212, 173, 90, 0.22);
}

.chronicles__house-tab {
  display: grid;
  gap: 3px;
  width: 100%;
  margin: 0 0 6px;
  padding: 9px;
  color: rgba(233, 221, 197, 0.72);
  text-align: left;
  background: rgba(15, 12, 9, 0.62);
  border: 1px solid rgba(112, 91, 54, 0.45);
  cursor: pointer;

  small {
    color: rgba(233, 221, 197, 0.45);
    font: 0.62rem 'ChatFont', sans-serif;
  }

  &--active {
    color: #f0d486;
    background: linear-gradient(90deg, rgba(95, 168, 147, 0.16), rgba(15, 12, 9, 0.72));
    border-color: rgba(95, 168, 147, 0.58);
  }
}

.chronicles__text-button {
  padding: 4px 0;
  color: #78bba7;
  font: 0.68rem 'ChatFont', sans-serif;
  text-decoration: underline;
  background: none;
  border: 0;
  cursor: pointer;

  &--new {
    margin-top: var(--space-xs);
    text-align: left;
  }
}

.chronicles__house-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  margin-bottom: var(--space-md);

  h2 {
    margin: 0;
    color: #f0d486;
    font-size: 1.45rem;
    font-weight: normal;
  }

  dl {
    display: flex;
    gap: var(--space-md);
    margin: 0;
  }

  dl div {
    text-align: center;
  }

  dt {
    color: rgba(233, 221, 197, 0.48);
    font: 0.6rem 'ChatFont', sans-serif;
    text-transform: uppercase;
  }

  dd {
    margin: 2px 0 0;
    color: #8bd2bc;
  }
}

.chronicles__roster {
  max-height: 178px;
  overflow-y: auto;
}

.chronicles__empty {
  margin: var(--space-sm) 0;
  color: rgba(233, 221, 197, 0.5);
  font: italic 0.72rem 'ChatFont', sans-serif;
}

.chronicles__scion {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  margin-bottom: 5px;
  padding: 4px 8px 4px 4px;
  color: #e9ddc5;
  text-align: left;
  background: rgba(11, 9, 7, 0.64);
  border: 1px solid rgba(95, 168, 147, 0.2);
  cursor: pointer;

  &--active {
    background: linear-gradient(90deg, rgba(95, 168, 147, 0.2), rgba(11, 9, 7, 0.7));
    border-color: #5fa893;
  }
}

.chronicles__portrait {
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  background-position: 0 0;
  background-size: 160px 160px;
  image-rendering: pixelated;
}

.chronicles__scion-copy {
  display: grid;
  gap: 2px;
  flex: 1;

  strong {
    color: #f0d486;
    font-weight: normal;
  }

  small {
    color: rgba(233, 221, 197, 0.52);
    font: 0.64rem 'ChatFont', sans-serif;
  }
}

.chronicles__selection {
  color: #78bba7;
}

.chronicles__scion-form {
  margin-top: var(--space-md);

  > label {
    display: block;
    margin-bottom: 5px;
    color: rgba(233, 221, 197, 0.64);
    font: 0.67rem 'ChatFont', sans-serif;
    text-transform: uppercase;
  }
}

.chronicles__mortal-option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 8px;
  color: rgba(233, 221, 197, 0.7);
  font: 0.66rem/1.35 'ChatFont', sans-serif;
  cursor: pointer;

  span {
    display: grid;
    gap: 2px;
  }

  strong {
    color: #d99b83;
    font-weight: normal;
    text-transform: uppercase;
  }

  small {
    color: rgba(233, 221, 197, 0.48);
    font: inherit;
  }
}

.chronicles__mortal-checkbox {
  margin-top: 2px;
  accent-color: #9f5544;
}

.chronicles__crypt {
  margin-top: var(--space-sm);
  color: rgba(233, 221, 197, 0.58);
  font: 0.68rem 'ChatFont', sans-serif;

  ul {
    margin: 5px 0;
    padding-left: 20px;
  }
}

.chronicles__set-out {
  width: 100%;
  margin-top: var(--space-md);
  padding: 10px;
  color: #102019;
  font-family: 'GameFont', sans-serif;
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: linear-gradient(180deg, #9bd1b9, #5fa893 58%, #3f7465);
  border: 1px solid #bce8d5;
  box-shadow: 0 0 14px rgba(95, 168, 147, 0.18);
  cursor: pointer;

  &:disabled {
    opacity: 0.42;
    cursor: not-allowed;
  }
}

.chronicles__error {
  margin: var(--space-sm) 0 0;
  padding: 7px 9px;
  color: #f4b2a4;
  font: 0.72rem 'ChatFont', sans-serif;
  background: rgba(105, 31, 24, 0.32);
  border: 1px solid rgba(224, 104, 83, 0.45);
}

button:focus-visible,
summary:focus-visible {
  outline: 2px solid #8bd2bc;
  outline-offset: 2px;
}

@media (width <= 580px) {
  .chronicles__ledger {
    grid-template-columns: 1fr;
  }

  .chronicles__houses {
    display: flex;
    gap: 5px;
    overflow-x: auto;
    padding: 0 0 var(--space-sm);
    border-right: 0;
    border-bottom: 1px solid rgba(212, 173, 90, 0.22);

    > .chronicles__section-label {
      display: none;
    }
  }

  .chronicles__house-tab {
    min-width: 132px;
  }

  .chronicles__text-button--new {
    min-width: 90px;
  }
}
</style>
