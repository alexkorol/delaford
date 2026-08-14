<template>
  <div class="stats_slot">
    <section class="character-hero" aria-label="Character summary">
      <div
        class="character-hero__portrait"
        role="img"
        :aria-label="characterSheet.identity.tile.label"
      >
        <span
          class="dcss-tile character-hero__sprite"
          :style="dcssTileStyle(characterSheet.identity.tile)"
        />
      </div>
      <div class="character-hero__identity">
        <span class="eyebrow">Character</span>
        <strong>{{ characterSheet.identity.name }}</strong>
        <span class="character-hero__state">XL {{ characterSheet.identity.level }} / {{ lifecycleState }}</span>
      </div>
      <div class="character-hero__meters">
        <span class="character-hero__meter">
          <b class="character-hero__meter-value">{{ characterSheet.resources.hp.current }}</b>
          / {{ characterSheet.resources.hp.max }} HP
        </span>
        <span class="character-hero__meter">
          <b class="character-hero__meter-value">{{ characterSheet.resources.mp.current }}</b>
          / {{ characterSheet.resources.mp.max }} MP
        </span>
      </div>
    </section>

    <section class="dcss-scoreboard" aria-label="Combat ratings">
      <div
        v-for="rating in characterSheet.defenses"
        :key="rating.id"
        class="score-pill"
      >
        <span class="score-pill__label">{{ rating.label }}</span>
        <strong class="score-pill__value">{{ rating.value }}</strong>
      </div>
      <div
        v-for="rating in characterSheet.offense"
        :key="rating.id"
        class="score-pill score-pill--offense"
      >
        <span class="score-pill__label">{{ rating.label }}</span>
        <strong class="score-pill__value">{{ rating.value }}</strong>
      </div>
    </section>

    <section class="vesselforge-summary" aria-label="Vesselforge effects">
      <header>Vesselforge Effects</header>
      <div class="vesselforge-grid">
        <div
          v-for="effect in characterSheet.vesselEffects"
          :key="effect.id"
          class="vesselforge-effect"
          :class="{ 'is-dormant': effect.value === 0 }"
          :title="effect.description"
        >
          <span class="vesselforge-effect__label">{{ effect.label }}</span>
          <strong class="vesselforge-effect__value">{{ effect.value }}{{ effect.suffix }}</strong>
        </div>
      </div>
    </section>

    <section class="equipment-summary">
      <header>Equipment</header>
      <ul class="equipment-summary__list">
        <li
          v-for="slot in characterSheet.equipment"
          :key="slot.id"
          class="equipment-summary__row"
          :class="{ 'is-empty': !slot.item }"
        >
          <span
            class="equipment-summary__tile"
            :title="slot.tile.label"
          >
            <span
              class="dcss-tile"
              :style="dcssTileStyle(slot.tile)"
            />
          </span>
          <span class="label">{{ slot.label }}</span>
          <span class="value">{{ slot.name }}</span>
        </li>
      </ul>
    </section>

    <section class="resistances">
      <header>Resistances</header>
      <div class="resistance-grid">
        <span
          v-for="resistance in characterSheet.resistances"
          :key="resistance.id"
          class="resistance-pill"
          :class="{ 'is-neutral': resistance.value === 0 }"
        >
          <b class="resistance-pill__label">{{ resistance.label }}</b>
          <span class="resistance-pill__pips">{{ resistance.pips }}</span>
        </span>
      </div>
    </section>

    <section v-if="characterSheet.skills.length" class="skills">
      <header>Skills</header>
      <ul>
        <li
          v-for="skill in characterSheet.skills"
          :key="skill.id"
        >
          <span class="label">{{ skill.label }}</span>
          <span class="value">{{ skill.level }}</span>
          <small>{{ formatExperience(skill.exp) }} XP</small>
        </li>
      </ul>
    </section>

    <section class="skill-tree">
      <header>Skill Tree</header>
      <p class="summary">
        <strong>{{ skillTreeSummary.earned }}</strong>
        <span>/</span>
        <span>{{ skillTreeSummary.cap }}</span>
        skill points
      </p>
      <p class="available">
        1 per level · {{ skillTreeSummary.cap }} at the cap
      </p>
      <button
        type="button"
        class="flower-button"
        @click="openSkillTree"
      >
        Open Skill Tree
      </button>
    </section>

    <section class="attributes">
      <header>Attributes</header>
      <ul>
        <li
          v-for="attribute in attributes"
          :key="attribute.id"
        >
          <span class="label">{{ attribute.label }}</span>
          <span class="value">{{ attribute.value }}</span>
          <small class="breakdown">
            <span class="base">B {{ attribute.breakdown.base }}</span>
            <span class="gear">G {{ attribute.breakdown.equipment }}</span>
            <span class="bonus">+ {{ attribute.breakdown.bonuses }}</span>
            <span class="passive">P {{ attribute.breakdown.passives }}</span>
          </small>
        </li>
      </ul>
    </section>

    <section class="lifecycle">
      <header>Life &amp; Death</header>
      <ul>
        <li>
          <span class="label">State</span>
          <span class="value">{{ lifecycleState }}</span>
        </li>
        <li>
          <span class="label">Deaths</span>
          <span class="value">{{ lifecycle.deaths }}</span>
        </li>
        <li>
          <span class="label">Lives</span>
          <span class="value">{{ lifecycle.livesRemaining }}</span>
        </li>
        <li>
          <span class="label">Cheat Death</span>
          <span class="value">{{ cheatDeathSummary }}</span>
        </li>
        <li>
          <span class="label">Respawn</span>
          <span class="value">{{ respawnSummary }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<script>
import { mapStores } from 'pinia';
import { ATTRIBUTE_IDS, ATTRIBUTE_LABELS, aggregateAttributes } from '@shared/stats/index.js';
import {
  computeFlowerAttributeBonuses,
  FLOWER_OF_LIFE_DEFAULT_PROGRESS,
} from '@shared/passives/flower-of-life.js';
import bus from '@/core/utilities/bus';
import { useUiStore } from '@/stores/ui.js';
import { buildCharacterSheet } from '@/core/character-sheet.js';
import {
  VERDIGRIS_SKILL_TREE_POINTS,
  VERDIGRIS_SKILL_TREE_SOURCES,
} from '@/core/passives/verdigris-skill-tree.js';
import objectsAtlasUrl from '@/assets/tiles/objects.png';
import playerAtlasUrl from '@/assets/graphics/actors/players/human-v2.png';
import armorAtlasUrl from '@/assets/graphics/items/armor.png';
import generalAtlasUrl from '@/assets/graphics/items/general.png';
import jewelryAtlasUrl from '@/assets/graphics/items/jewelry.png';
import vesselsAtlasUrl from '@/assets/graphics/items/vessels.png';
import weaponsAtlasUrl from '@/assets/graphics/items/weapons.png';

const DCSS_ATLAS_URLS = {
  armor: armorAtlasUrl,
  general: generalAtlasUrl,
  jewelry: jewelryAtlasUrl,
  objects: objectsAtlasUrl,
  players: playerAtlasUrl,
  vessels: vesselsAtlasUrl,
  weapons: weaponsAtlasUrl,
};

const normaliseNumber = value => (Number.isFinite(value) ? value : 0);
const normaliseAttributes = (source = {}) => ATTRIBUTE_IDS.reduce((acc, attributeId) => {
  acc[attributeId] = normaliseNumber(source[attributeId]);
  return acc;
}, {});

export default {
  props: {
    game: {
      type: Object,
      required: true,
    },
  },
  computed: {
    ...mapStores(useUiStore),
    player() {
      return this.game && this.game.player ? this.game.player : {};
    },
    flowerProgress() {
      return this.uiStore?.flowerOfLifeState || FLOWER_OF_LIFE_DEFAULT_PROGRESS;
    },
    skillTreeSummary() {
      const level = Number(this.player && this.player.level) || 1;
      const earned = Math.min(
        VERDIGRIS_SKILL_TREE_POINTS.skill,
        Math.min(Math.max(0, level - 1), VERDIGRIS_SKILL_TREE_SOURCES.levels),
      );
      return {
        earned,
        cap: VERDIGRIS_SKILL_TREE_POINTS.skill,
      };
    },
    stats() {
      if (!this.player) {
        return {};
      }

      return this.player.stats || {};
    },
    characterSheet() {
      return buildCharacterSheet(this.player);
    },
    attributeSources() {
      const sources = this.stats.attributes && this.stats.attributes.sources
        ? this.stats.attributes.sources
        : {};

      return {
        base: sources.base || {},
        equipment: sources.equipment || {},
        bonuses: sources.bonuses || {},
        passives: sources.passives || {},
      };
    },
    passiveAttributeBonuses() {
      return computeFlowerAttributeBonuses(this.flowerProgress);
    },
    attributes() {
      const base = normaliseAttributes(this.attributeSources.base);
      const equipment = normaliseAttributes(this.attributeSources.equipment);
      const bonuses = normaliseAttributes(this.attributeSources.bonuses);
      const passiveFromStats = normaliseAttributes(this.attributeSources.passives);
      const passiveLocal = normaliseAttributes(this.passiveAttributeBonuses);

      const passives = normaliseAttributes({});
      const hasServerPassive = ATTRIBUTE_IDS.some(attributeId => passiveFromStats[attributeId] !== 0);
      ATTRIBUTE_IDS.forEach((attributeId) => {
        const localContribution = hasServerPassive ? 0 : passiveLocal[attributeId];
        passives[attributeId] = passiveFromStats[attributeId] + localContribution;
      });

      const aggregated = aggregateAttributes({
        base,
        equipment,
        bonuses,
        passives,
      });

      return ATTRIBUTE_IDS.map((attributeId) => {
        const breakdown = {
          base: normaliseNumber(aggregated.sources.base[attributeId]),
          equipment: normaliseNumber(aggregated.sources.equipment[attributeId]),
          bonuses: normaliseNumber(aggregated.sources.bonuses[attributeId]),
          passives: normaliseNumber(aggregated.sources.passives[attributeId]),
        };

        return {
          id: attributeId,
          label: ATTRIBUTE_LABELS[attributeId] || attributeId,
          value: normaliseNumber(aggregated.total[attributeId]),
          breakdown,
        };
      });
    },
    lifecycle() {
      const lifecycle = this.player.lifecycle
        || (this.stats ? this.stats.lifecycle : null)
        || {};

      return {
        state: lifecycle.state || 'unknown',
        mode: lifecycle.mode || 'soft',
        deaths: normaliseNumber(lifecycle.deaths),
        livesRemaining: normaliseNumber(lifecycle.livesRemaining),
        cheatDeath: lifecycle.cheatDeath || {},
        respawn: lifecycle.respawn || {},
      };
    },
    lifecycleState() {
      const label = this.lifecycle.state || 'unknown';
      return label.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
    },
    cheatDeathSummary() {
      const { cheatDeath } = this.lifecycle;
      const charges = normaliseNumber(cheatDeath.charges);
      if (charges <= 0) {
        return 'None';
      }

      const cooldown = normaliseNumber(cheatDeath.cooldownMs);
      if (cooldown > 0) {
        const seconds = Math.round(cooldown / 1000);
        return `${charges} (${seconds}s cd)`;
      }

      return `${charges} ready`;
    },
    respawnSummary() {
      const { respawn } = this.lifecycle;
      if (this.lifecycle.state === 'permadead') {
        return 'Locked';
      }

      if (!respawn || !respawn.pending) {
        return 'Ready';
      }

      if (respawn.at) {
        const remainingMs = respawn.at - Date.now();
        const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
        return `Pending (${remainingSeconds}s)`;
      }

      return 'Pending';
    },
  },
  methods: {
    formatExperience(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        return '0';
      }
      return Math.floor(number).toLocaleString();
    },
    dcssTileStyle(tile) {
      if (!tile) {
        return {};
      }

      const tileSize = Number.isFinite(Number(tile.tileSize)) ? Number(tile.tileSize) : 32;
      const atlasUrl = DCSS_ATLAS_URLS[tile.atlas] || DCSS_ATLAS_URLS.objects;
      return {
        '--dcss-tile-size': `${tileSize}px`,
        backgroundImage: `url(${atlasUrl})`,
        backgroundPosition: `left -${tile.column * tileSize}px top -${tile.row * tileSize}px`,
      };
    },
    openSkillTree() {
      bus.$emit('skill-tree:open');
    },
  },
};
</script>

<style lang="scss" scoped>
div.stats_slot {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  padding-right: 2px;
  color: #f1f1f1;
  font-family: "GameFont", sans-serif;
  font-size: var(--font-size-sm);
  line-height: 1.55;
  text-align: left;
  text-shadow: 1px 1px 0 #000;

  section {
    padding: 10px;
    border: 1px solid rgba(180, 145, 86, 0.24);
    border-radius: 0;
    background:
      linear-gradient(180deg, rgba(21, 23, 26, 0.82), rgba(5, 7, 9, 0.78)),
      rgba(0, 0, 0, 0.36);
    box-shadow: inset 0 0 14px rgba(0, 0, 0, 0.46);

    header {
      margin-bottom: 8px;
      color: #f5d68a;
      font-size: var(--font-size-sm);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: minmax(78px, 0.55fr) minmax(0, 1fr);
    gap: 5px 10px;
    align-items: baseline;
    min-width: 0;

    .label {
      color: rgba(235, 222, 190, 0.72);
    }

    .value {
      min-width: 0;
      overflow: hidden;
      color: #f7e5b0;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      grid-column: 1 / -1;
      color: rgba(160, 183, 203, 0.76);
      font-size: 0.86em;
    }
  }
}

.dcss-tile {
  display: block;
  width: var(--dcss-tile-size, 32px);
  height: var(--dcss-tile-size, 32px);
  background-repeat: no-repeat;
  image-rendering: pixelated;
}

.character-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  background:
    radial-gradient(circle at 18% 36%, rgba(87, 28, 30, 0.32), transparent 35%),
    linear-gradient(135deg, rgba(30, 33, 35, 0.94), rgba(7, 9, 11, 0.9));

  &__portrait {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 54px;
    height: 54px;
    border: 1px solid rgba(219, 181, 98, 0.38);
    border-radius: 0;
    background:
      radial-gradient(circle at 50% 38%, rgba(92, 121, 90, 0.38), transparent 44%),
      linear-gradient(180deg, #191814, #080908);
    box-shadow:
      inset 0 0 14px rgba(0, 0, 0, 0.78),
      0 3px 8px rgba(0, 0, 0, 0.36);
    overflow: hidden;

    .character-hero__sprite {
      transform: scale(0.82);
      transform-origin: center;
      filter: drop-shadow(0 3px 2px rgba(0, 0, 0, 0.84));
    }
  }

  &__identity {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 2px;

    .eyebrow {
      color: rgba(133, 178, 191, 0.8);
      font-size: 10px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    strong {
      overflow: hidden;
      color: #fff1c2;
      font-size: clamp(16px, 1.25vw, 20px);
      line-height: 1.1;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

  }

  &__state {
    color: rgba(239, 229, 203, 0.78);
  }

  &__meters {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;

  }

  &__meter {
    display: block;
    padding: 5px 7px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0;
    background: rgba(0, 0, 0, 0.34);
    color: rgba(235, 226, 203, 0.8);
    text-align: right;

  }

  &__meter-value {
    color: #fff3c9;
  }
}

.equipment-summary {
  .equipment-summary__list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 8px;
  }

  .equipment-summary__row {
    grid-template-columns: 34px minmax(0, 1fr);
    grid-template-rows: auto auto;
    gap: 2px 8px;
    align-items: center;
    min-height: 38px;
    padding: 4px 6px;
    border: 1px solid rgba(202, 172, 104, 0.14);
    border-radius: 0;
    background: rgba(2, 3, 5, 0.22);

    .label,
    .value {
      grid-column: 2;
      line-height: 1.1;
    }

    .label {
      grid-row: 1;
      font-size: 0.92em;
    }

    .value {
      grid-row: 2;
    }
  }

  .equipment-summary__tile {
    display: grid;
    grid-row: 1 / span 2;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 1px solid rgba(213, 181, 112, 0.18);
    border-radius: 0;
    background: rgba(1, 2, 4, 0.5);
    box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.62);

    .dcss-tile {
      filter: drop-shadow(0 2px 1px rgba(0, 0, 0, 0.8));
    }
  }

  .is-empty {
    .equipment-summary__tile {
      opacity: 0.58;
    }

    .value {
      color: rgba(235, 222, 190, 0.56);
      font-weight: 500;
    }
  }
}

.dcss-scoreboard,
.resistance-grid,
.vesselforge-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
}

.score-pill,
.resistance-pill {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 7px;
  border: 1px solid rgba(202, 172, 104, 0.22);
  border-radius: 0;
  background: rgba(2, 3, 5, 0.46);

}

.score-pill__label,
.resistance-pill__pips {
  overflow: hidden;
  color: rgba(226, 218, 196, 0.78);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score-pill__value,
.resistance-pill__label {
  color: #f6d982;
}

.score-pill--offense .score-pill__value {
  color: #92cbdf;
}

.vesselforge-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.vesselforge-effect {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 8px;
  border: 1px solid rgba(118, 173, 151, 0.28);
  border-radius: 4px;
  background:
    linear-gradient(135deg, rgba(29, 67, 57, 0.28), rgba(3, 9, 9, 0.52)),
    rgba(2, 3, 5, 0.46);

  &__label {
    overflow: hidden;
    color: rgba(198, 224, 210, 0.78);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__value {
    color: #9bd9bd;
  }

  &.is-dormant {
    border-color: rgba(202, 172, 104, 0.14);
    background: rgba(2, 3, 5, 0.34);
    opacity: 0.66;

    .vesselforge-effect__value {
      color: rgba(226, 218, 196, 0.68);
    }
  }
}

.resistance-pill {
  grid-template-columns: 1fr auto;
  color: #bdd6c8;

  &.is-neutral {
    opacity: 0.68;
  }
}

.attributes .breakdown {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: rgba(225, 219, 203, 0.68);
  font-size: 0.86em;

  .passive {
    color: #80cbc4;
  }
}

.skill-tree {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;

  .summary,
  .available {
    margin: 0;
  }

  .summary {
    display: flex;
    gap: 5px;
    align-items: baseline;

    strong {
      color: #ffd54f;
    }
  }

  .available {
    color: rgba(255, 255, 255, 0.75);
  }

  .flower-button {
    margin-top: 2px;
    padding: 6px 9px;
    border: 1px solid rgba(208, 171, 90, 0.35);
    border-radius: 0;
    background: var(--control-surface);
    color: #f1f1f1;
    font-size: var(--font-size-sm);
    letter-spacing: 0.03em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;

    &:hover {
      border-color: rgba(255, 215, 79, 0.55);
      background: var(--control-surface-hover);
    }
  }
}

@media (width <= 520px) {
  .dcss-scoreboard,
  .resistance-grid,
  .vesselforge-grid,
  .character-hero__meters {
    grid-template-columns: 1fr 1fr;
  }

  div.stats_slot li {
    grid-template-columns: 1fr;
  }

  div.stats_slot .equipment-summary__row {
    grid-template-columns: 34px minmax(0, 1fr);

    .label,
    .value {
      grid-column: 2;
    }
  }
}
</style>
