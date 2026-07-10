<template>
  <section class="chronicles" aria-labelledby="chronicles-title">
    <header class="chronicles__header">
      <p class="chronicles__eyebrow">The Chronicles</p>
      <h1 id="chronicles-title">{{ activeHouse ? `House ${activeHouse.name}` : 'Found Your House' }}</h1>
      <p v-if="activeHouse" class="chronicles__ledger">
        {{ activeHouse.renown }} renown · deepest descent {{ activeHouse.bestDepth || 0 }}
      </p>
    </header>

    <div v-if="fallen" class="chronicles__fall" role="status">
      <strong>{{ fallen.name }} has fallen.</strong>
      <span>Level {{ fallen.level }} · committed to the crypt.</span>
      <span v-if="relicCount">{{ relicCount }} relic{{ relicCount === 1 ? '' : 's' }} returned to the world.</span>
    </div>

    <p v-if="error" class="chronicles__error" role="alert">{{ error }}</p>

    <form v-if="!activeHouse" class="chronicles__form" @submit.prevent="foundHouse">
      <label for="house-name">House name</label>
      <input
        id="house-name"
        v-model="houseName"
        minlength="3"
        maxlength="20"
        autocomplete="off"
        placeholder="Vaelmont"
        required
      >
      <button type="submit">Found House</button>
    </form>

    <template v-else>
      <div class="chronicles__columns">
        <section>
          <h2>Living Scions</h2>
          <p v-if="!activeHouse.scions.length" class="chronicles__empty">
            The hall waits for its first name.
          </p>
          <article v-for="scion in activeHouse.scions" :key="scion.id" class="chronicles__scion">
            <div>
              <strong>{{ scion.name }}</strong>
              <span>Level {{ scion.level }} · depth {{ scion.bestDepth || 0 }}</span>
            </div>
            <button type="button" @click="setOut(scion.id)">Set Out</button>
          </article>

          <form class="chronicles__form chronicles__form--scion" @submit.prevent="createScion">
            <label for="scion-name">Name a new scion</label>
            <div class="chronicles__form-row">
              <input
                id="scion-name"
                v-model="scionName"
                minlength="2"
                maxlength="20"
                autocomplete="off"
                placeholder="Orun"
                required
              >
              <button type="submit">Create Scion</button>
            </div>
            <small>Scions are mortal. Their final death is permanent.</small>
          </form>
        </section>

        <section class="chronicles__crypt">
          <h2>The Crypt <span>{{ activeHouse.crypt.length }}</span></h2>
          <p v-if="!activeHouse.crypt.length" class="chronicles__empty">No names are carved here yet.</p>
          <article v-for="scion in activeHouse.crypt" :key="scion.id" class="chronicles__dead">
            <strong>{{ scion.name }}</strong>
            <span>Level {{ scion.level }} · {{ scion.cause || 'Fell in battle' }}</span>
            <small v-if="scion.relics?.length">Relics: {{ scion.relics.join(', ') }}</small>
          </article>
          <div v-if="chronicle.leaderboard?.length" class="chronicles__leaderboard">
            <h2>Deepest Houses</h2>
            <ol>
              <li v-for="entry in chronicle.leaderboard" :key="entry.houseId">
                <span>House {{ entry.houseName }}</span>
                <strong>{{ entry.bestDepth }}</strong>
              </li>
            </ol>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import Socket from '@/core/utilities/socket.js';

const props = defineProps({
  chronicle: { type: Object, default: () => ({ houses: [], activeHouseId: null }) },
  error: { type: String, default: '' },
  fall: { type: Object, default: null },
});

const houseName = ref('');
const scionName = ref('');
const selectedHouseId = ref(props.chronicle?.activeHouseId || null);

watch(() => props.chronicle?.activeHouseId, (value) => {
  if (value) selectedHouseId.value = value;
});

const activeHouse = computed(() => {
  const houses = Array.isArray(props.chronicle?.houses) ? props.chronicle.houses : [];
  return houses.find(house => house.id === selectedHouseId.value) || houses[0] || null;
});
const fallen = computed(() => props.fall?.fallen || null);
const relicCount = computed(() => Number(props.fall?.relicCount) || 0);

const foundHouse = () => {
  Socket.emit('chronicles:house:found', { name: houseName.value });
};

const createScion = () => {
  if (!activeHouse.value) return;
  Socket.emit('chronicles:scion:create', {
    houseId: activeHouse.value.id,
    name: scionName.value,
  });
  scionName.value = '';
};

const setOut = (scionId) => {
  Socket.setResumeScion(scionId);
  Socket.emit('chronicles:scion:set-out', { scionId });
};
</script>

<style scoped lang="scss">
.chronicles {
  color: #e8dcc5;
  font-family: 'ChatFont', sans-serif;
}

h1,
h2 {
  font-family: 'GameFont', sans-serif;
  font-weight: normal;
}

h1 {
  margin: 0.3rem 0;
  color: #e7c978;
}

h2 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h2 span {
  color: #8a7d6b;
}

label,
small {
  color: #a99d89;
  font-size: 0.78rem;
}

input {
  padding: 0.65rem;
  color: #f3e4bd;
  background: #0d0b09;
  border: 1px solid #695839;
}

button {
  padding: 0.55rem 0.8rem;
  color: #f7eeda;
  background: linear-gradient(#786342, #463720);
  border: 1px solid #b09055;
  cursor: pointer;
  font-family: 'GameFont', sans-serif;
}

button:hover,
button:focus-visible {
  border-color: #79bda9;
}

.chronicles__header {
  margin-bottom: 1.25rem;
  text-align: center;
}

.chronicles__eyebrow {
  margin: 0;
  color: #73b9a6;
  font-size: 0.72rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
}

.chronicles__ledger,
.chronicles__empty {
  margin: 0;
  color: #978d7e;
}

.chronicles__columns {
  display: grid;
  grid-template-columns: 1.35fr 0.9fr;
  gap: 1.25rem;
}

.chronicles__crypt {
  padding-left: 1.25rem;
  border-left: 1px solid rgba(179, 151, 98, 0.25);
}

.chronicles__scion,
.chronicles__dead {
  padding: 0.7rem;
  margin-bottom: 0.6rem;
  background: rgba(4, 4, 5, 0.35);
  border: 1px solid rgba(179, 151, 98, 0.3);
}

.chronicles__scion {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
}

.chronicles__scion div,
.chronicles__dead {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.chronicles__scion span,
.chronicles__dead span,
.chronicles__dead small {
  color: #9c9181;
  font-size: 0.78rem;
}

.chronicles__form {
  display: grid;
  gap: 0.55rem;
  max-width: 360px;
  margin: 0 auto;
}

.chronicles__form--scion {
  max-width: none;
  margin-top: 1rem;
}

.chronicles__form-row {
  display: flex;
  gap: 0.5rem;
}

.chronicles__form-row input {
  min-width: 0;
  flex: 1;
}

.chronicles__fall {
  display: grid;
  gap: 0.2rem;
  padding: 0.8rem;
  margin-bottom: 1rem;
  color: #d7c3b4;
  text-align: center;
  background: rgba(80, 15, 18, 0.55);
  border: 1px solid #93464b;
}

.chronicles__fall strong {
  color: #f0c5c0;
  font-family: 'GameFont', sans-serif;
}

.chronicles__error {
  color: #efb3ad;
  text-align: center;
}

.chronicles__leaderboard {
  margin-top: 1.25rem;
}

.chronicles__leaderboard ol {
  padding-left: 1.4rem;
  margin: 0;
}

.chronicles__leaderboard li {
  padding: 0.25rem 0;
  color: #9c9181;
}

.chronicles__leaderboard li span {
  display: inline-block;
  min-width: 10rem;
}

.chronicles__leaderboard li strong {
  color: #73b9a6;
}

@media (width <= 650px) {
  .chronicles__columns {
    grid-template-columns: 1fr;
  }

  .chronicles__crypt {
    padding: 1rem 0 0;
    border-top: 1px solid rgba(179, 151, 98, 0.25);
    border-left: 0;
  }
}
</style>
