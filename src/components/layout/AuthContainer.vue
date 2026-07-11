<template>
  <div
    class="auth-container"
    :class="{ 'auth-container--landing': screen === 'main' }"
  >
    <div
      class="auth-container__backdrop"
      aria-hidden="true"
    >
      <LoginBackdrop />
    </div>
    <div class="auth-container__frame" :class="{ 'auth-container__frame--landing': screen === 'main' }">
      <AudioMainMenu />
      <i
        class="auth-container__corner auth-container__corner--tl"
        aria-hidden="true"
      ></i>
      <i
        class="auth-container__corner auth-container__corner--tr"
        aria-hidden="true"
      ></i>
      <i
        class="auth-container__corner auth-container__corner--bl"
        aria-hidden="true"
      ></i>
      <i
        class="auth-container__corner auth-container__corner--br"
        aria-hidden="true"
      ></i>
      <div
        v-if="screen === 'server-down'"
        class="auth-container__panel auth-container__panel--server"
      >
        The game server is down. Please check the website for more information.
      </div>
      <div
        v-else
        class="auth-container__panel"
      >
        <div
          v-if="screen === 'register'"
          class="auth-container__register"
        >
          <AccountCreate
            @cancel="emitNavigate('main')"
            @registered="emitNavigate('login')"
          />
        </div>

        <div
          v-else-if="screen === 'login'"
          class="auth-container__login"
        >
          <div class="auth-container__wordmark">
            <h1 class="auth-container__title">Verdigris</h1>
            <div class="auth-container__rule"><span /></div>
          </div>
          <Login />
        </div>

        <ChroniclesScreen
          v-else-if="screen === 'chronicles'"
          :chronicle="chronicle"
          :error="chronicleError"
          :fall="chronicleFall"
        />

        <div v-else>
          <div class="auth-container__wordmark">
            <h1 class="auth-container__title">Verdigris</h1>
            <p class="auth-container__tagline">Every scion dies. Every House remembers.</p>
            <div class="auth-container__rule"><span /></div>
          </div>
          <p class="auth-container__lede">
            A persistent-House action RPG where mortal scions descend together,
            build strange gear, and leave relics for future adventurers to find.
          </p>
          <div class="auth-container__features">
            <article><strong>Descend</strong><span>Procedural floors grow harsher until your build breaks.</span></article>
            <article><strong>Build</strong><span>Shape a scion through loot and a 271-node passive lattice.</span></article>
            <article><strong>Be remembered</strong><span>Final deaths enter the crypt; notable gear returns to the world.</span></article>
          </div>
          <div class="auth-container__button-group">
            <button
              class="auth-container__button auth-container__button--login"
              type="button"
              @click="emitNavigate('login')"
            >
              Sign in
            </button>
            <button
              class="auth-container__button auth-container__button--register"
              type="button"
              @click="emitNavigate('register')"
            >
              Create account
            </button>
          </div>
          <p class="auth-container__credit">
            Verdigris grew from Delaford, created by Dan Jasnowski, and preserves its MIT-licensed foundation.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import AudioMainMenu from '../sub/AudioMainMenu.vue';
import LoginBackdrop from '../sub/LoginBackdrop.vue';
import Login from '../ui/Login.vue';
import AccountCreate from '../ui/auth/AccountCreate.vue';
import ChroniclesScreen from '../ui/auth/ChroniclesScreen.vue';

export default {
  name: 'AuthContainer',
  components: {
    AudioMainMenu,
    LoginBackdrop,
    Login,
    AccountCreate,
    ChroniclesScreen,
  },
  props: {
    screen: {
      type: String,
      default: 'login',
    },
    chronicle: { type: Object, default: () => ({ houses: [], activeHouseId: null }) },
    chronicleError: { type: String, default: '' },
    chronicleFall: { type: Object, default: null },
  },
  emits: ['navigate'],
  methods: {
    emitNavigate(target) {
      this.$emit('navigate', target);
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/assets/scss/abstracts/tokens' as *;

.auth-container {
  width: min(640px, 94vw);
  position: relative;
  margin: auto;
}

.auth-container--landing {
  width: min(800px, 94vw);
}

/* Fullscreen scene behind the panel: live-rendered dungeon vestibule
 * (LoginBackdrop canvas) under a vignette and a slow warm glow. */
.auth-container__backdrop {
  position: fixed;
  inset: 0;
  background: linear-gradient(180deg, #0d0f16 0%, #121014 55%, #16120d 100%);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 1;
    background:
      linear-gradient(180deg, rgba(8, 8, 14, 0.22) 0%, rgba(8, 8, 14, 0.08) 45%, rgba(10, 8, 8, 0.26) 100%),
      radial-gradient(130% 100% at 50% 50%, transparent 48%, rgba(2, 2, 6, 0.6) 100%);
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 2;
    background: radial-gradient(60% 38% at 50% 108%, rgba(228, 160, 64, 0.14), transparent 70%);
    opacity: 0.55;
  }
}

.auth-container__frame {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 520px;
  width: 100%;
  box-sizing: border-box;
  padding: var(--space-2xl) var(--space-xl) var(--space-xl);
  background:
    linear-gradient(180deg, rgba(40, 33, 25, 0.72) 0%, rgba(14, 11, 9, 0.94) 100%),
    #14110d;
  border: 1px solid var(--color-border-strong);
  box-shadow:
    0 0 0 4px #0a0806,
    0 0 0 5px rgba(212, 173, 90, 0.22),
    0 28px 64px rgba(0, 0, 0, 0.75),
    inset 0 0 48px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(240, 230, 210, 0.06);
}

.auth-container__frame--landing {
  min-height: 650px;
  padding-inline: clamp(32px, 6vw, 64px);
}

@media (prefers-reduced-motion: no-preference) {
  .auth-container__backdrop::after {
    animation: auth-glow 9s ease-in-out infinite alternate;
  }

  .auth-container__frame {
    animation: auth-rise 480ms ease-out both;
  }
}

@keyframes auth-glow {
  from { opacity: 0.3; }
  to { opacity: 0.8; }
}

@keyframes auth-rise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}

/* Accents oxidize verdigris-green against the bronze, per the name. */
.auth-container__corner {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 2px solid #5fa893;
  opacity: 0.8;
  pointer-events: none;

  &--tl {
    top: 6px;
    left: 6px;
    border-right: 0;
    border-bottom: 0;
  }

  &--tr {
    top: 6px;
    right: 6px;
    border-left: 0;
    border-bottom: 0;
  }

  &--bl {
    bottom: 6px;
    left: 6px;
    border-right: 0;
    border-top: 0;
  }

  &--br {
    right: 6px;
    bottom: 6px;
    border-top: 0;
    border-left: 0;
  }
}

.auth-container__panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-lg);
  width: 100%;
  margin: auto 0;
}

.auth-container__panel--server {
  font-size: 0.85em;
  text-align: center;
  font-family: 'ChatFont', sans-serif;
  color: var(--color-text-secondary);
}

.auth-container__register-intro {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.85);
  text-align: center;

  a {
    color: #f3b15b;
    text-decoration: underline;
  }
}

.auth-container__lede {
  max-width: 520px;
  margin: 0 auto;
  text-align: center;
  line-height: 1.55;
  color: rgba(235, 225, 205, 0.82);
}

.auth-container__features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;

  article {
    display: grid;
    gap: var(--space-xs);
    min-height: 112px;
    padding: 16px;
    background: rgba(8, 7, 5, 0.5);
    border: 1px solid rgba(95, 168, 147, 0.25);
  }

  strong {
    font-family: 'GameFont', sans-serif;
    color: #d9bd72;
  }

  span {
    font-size: 0.82rem;
    line-height: 1.4;
    color: rgba(225, 215, 195, 0.68);
  }
}

.auth-container__credit {
  margin: var(--space-lg) auto 0;
  max-width: 500px;
  text-align: center;
  font-size: 0.72rem;
  line-height: 1.45;
  color: rgba(220, 210, 190, 0.48);
}

@media (width <= 620px) {
  .auth-container__features {
    grid-template-columns: 1fr;
  }

  .auth-container__button-group {
    flex-direction: column;
    gap: var(--space-sm);
  }
}

.auth-container__wordmark {
  text-align: center;
  margin: 0 auto var(--space-lg);
}

.auth-container__title {
  margin: 0;
  font-family: 'GameFont', sans-serif;
  font-weight: normal;
  font-size: clamp(2.4rem, 6vw, 3.4rem);
  line-height: 1.1;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: linear-gradient(180deg, #f4dfa0 0%, #d4ad5a 45%, #8a6a32 78%, #b08b48 100%);
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 2px 0 #1a1208) drop-shadow(0 4px 10px rgba(0, 0, 0, 0.6));
}

.auth-container__tagline {
  margin: var(--space-xs) 0 0;
  font-family: 'ChatFont', sans-serif;
  font-size: 0.78rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: rgba(220, 205, 180, 0.55);
}

.auth-container__rule {
  position: relative;
  height: 1px;
  margin: var(--space-md) auto 0;
  width: min(320px, 72%);
  background: linear-gradient(90deg, transparent, rgba(95, 168, 147, 0.65) 18%, rgba(95, 168, 147, 0.65) 82%, transparent);

  span {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 7px;
    height: 7px;
    transform: translate(-50%, -50%) rotate(45deg);
    background: #5fa893;
    box-shadow: 0 0 8px rgba(95, 168, 147, 0.7);
  }
}

.auth-container__button-group {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: var(--space-lg);
}

.auth-container__button {
  min-width: 180px;
  font-family: 'GameFont', sans-serif;
  font-size: 1.15rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #f7eeda;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.85);
  background: linear-gradient(180deg, #84704c 0%, #5a4830 55%, #443723 100%);
  border: 2px solid #20180d;
  border-top-color: rgba(238, 216, 166, 0.55);
  border-left-color: rgba(238, 216, 166, 0.35);
  padding: var(--space-sm) var(--space-xl);
  cursor: pointer;
  box-shadow:
    0 4px 10px rgba(0, 0, 0, 0.45),
    inset 0 0 12px rgba(0, 0, 0, 0.25);

  &:hover {
    background: linear-gradient(180deg, #97825a 0%, #6a5538 55%, #4e3f28 100%);
    box-shadow:
      0 4px 10px rgba(0, 0, 0, 0.45),
      0 0 14px rgba(212, 173, 90, 0.25),
      inset 0 0 12px rgba(0, 0, 0, 0.25);
  }

  &:active {
    transform: translateY(1px);
    border-top-color: #20180d;
    border-left-color: #20180d;
    border-bottom-color: rgba(230, 205, 150, 0.3);
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent-strong);
    outline-offset: 2px;
  }
}

.auth-container__button--register {
  background: linear-gradient(180deg, #4d8878 0%, #356559 55%, #294e45 100%);
  border-top-color: rgba(174, 232, 212, 0.55);
  border-left-color: rgba(174, 232, 212, 0.35);

  &:hover {
    background: linear-gradient(180deg, #5b9c8a 0%, #3d7567 55%, #2d594e 100%);
  }
}
</style>
