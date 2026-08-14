<template>
  <div class="auth-container">
    <div
      class="auth-container__backdrop"
      aria-hidden="true"
    >
      <LoginBackdrop />
    </div>
    <div class="auth-container__frame">
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
        :class="{ 'auth-container__panel--chronicles': screen === 'chronicles' }"
      >
        <ChroniclesScreen
          v-if="screen === 'chronicles'"
          :account-name="chroniclesContext && chroniclesContext.accountName"
          :account-id="chroniclesContext && chroniclesContext.chroniclesAccountId"
          :chronicles-state="chroniclesContext && chroniclesContext.chronicles"
          :chronicles-revision="chroniclesContext && chroniclesContext.chroniclesRevision"
          :chronicles-exists="Boolean(chroniclesContext && chroniclesContext.chroniclesExists)"
          @set-out="$emit('set-out', $event)"
        />

        <div
          v-else-if="screen === 'register'"
          class="auth-container__register"
        >
          <p class="auth-container__register-intro">
            To register an account, please visit
            <a href="https://delaford.com/register">this page</a>
            to get started and then come back. Once you have an account ID, reserve your in-world identity below.
          </p>
          <CharacterCreate />
        </div>

        <div
          v-else-if="screen === 'login'"
          class="auth-container__login"
        >
          <div class="auth-container__wordmark">
            <p class="auth-container__eyebrow">The roads remember</p>
            <h1 class="auth-container__title">Verdigris</h1>
            <p class="auth-container__tagline">A WASD-first multiplayer ARPG</p>
            <div class="auth-container__rule"><span /></div>
          </div>
          <Login />
          <p class="auth-container__promise">
            Persistent Houses <span aria-hidden="true">&middot;</span>
            Shared roads <span aria-hidden="true">&middot;</span>
            No download
          </p>
        </div>

        <div v-else>
          <div class="auth-container__wordmark">
            <h1 class="auth-container__title">Verdigris</h1>
            <p class="auth-container__tagline">a multiplayer adventure</p>
            <div class="auth-container__rule"><span /></div>
          </div>
          <div class="auth-container__button-group">
            <button
              class="auth-container__button auth-container__button--login"
              type="button"
              @click="emitNavigate('login')"
            >
              Login
            </button>
            <button
              class="auth-container__button auth-container__button--register"
              type="button"
              @click="emitNavigate('register')"
            >
              Register
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import AudioMainMenu from '../sub/AudioMainMenu.vue';
import LoginBackdrop from '../sub/LoginBackdrop.vue';
import Login from '../ui/Login.vue';
import CharacterCreate from '../ui/auth/CharacterCreate.vue';
import ChroniclesScreen from '../ui/auth/ChroniclesScreen.vue';

export default {
  name: 'AuthContainer',
  components: {
    AudioMainMenu,
    LoginBackdrop,
    Login,
    CharacterCreate,
    ChroniclesScreen,
  },
  props: {
    screen: {
      type: String,
      default: 'login',
    },
    chroniclesContext: {
      type: Object,
      default: null,
    },
  },
  emits: ['navigate', 'set-out'],
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
  width: min(700px, 94vw);
  position: relative;
  margin: auto;
}

/* The opening now looks into the same Delaford streets used by play. */
.auth-container__backdrop {
  position: fixed;
  inset: 0;
  background: linear-gradient(180deg, #07100c 0%, #11160e 55%, #171108 100%);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 1;
    background:
      linear-gradient(180deg, rgba(3, 8, 6, 0.12) 0%, rgba(8, 8, 5, 0.04) 45%, rgba(10, 7, 3, 0.2) 100%),
      radial-gradient(130% 100% at 50% 50%, transparent 42%, rgba(2, 4, 3, 0.5) 100%);
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 2;
    background: radial-gradient(60% 42% at 50% 106%, rgba(228, 160, 64, 0.17), transparent 70%);
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
  padding: clamp(30px, 4.5vh, 48px) clamp(24px, 4vw, 42px) clamp(24px, 3vh, 34px);
  background:
    radial-gradient(circle at 50% -5%, rgba(123, 85, 35, 0.2), transparent 36%),
    linear-gradient(180deg, rgba(31, 27, 21, 0.9) 0%, rgba(10, 10, 9, 0.97) 100%),
    #14110d;
  border: 16px solid transparent;
  border-image: url('@/assets/inventory/frame_ornate.png') 118 / 16px stretch;
  box-shadow:
    0 0 0 2px rgba(5, 5, 4, 0.94),
    0 30px 72px rgba(0, 0, 0, 0.8),
    inset 0 0 52px rgba(0, 0, 0, 0.64),
    inset 0 1px 0 rgba(240, 230, 210, 0.06);
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

.auth-container__panel--chronicles {
  justify-content: flex-start;
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

.auth-container__wordmark {
  text-align: center;
  margin: 0 auto var(--space-lg);
}

.auth-container__eyebrow {
  margin: 0 0 8px;
  color: #80bea9;
  font: 0.68rem 'ChatFont', sans-serif;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  text-shadow: 0 1px 2px #000;
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
  margin: 7px 0 0;
  font-family: 'ChatFont', sans-serif;
  font-size: 0.78rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: rgba(232, 218, 190, 0.68);
}

.auth-container__promise {
  margin: var(--space-lg) 0 0;
  color: rgba(198, 187, 164, 0.55);
  font: 0.65rem 'ChatFont', sans-serif;
  letter-spacing: 0.08em;
  text-align: center;
  text-transform: uppercase;

  span {
    margin-inline: 6px;
    color: rgba(95, 168, 147, 0.72);
  }
}

@media (width <= 580px), (height <= 680px) {
  .auth-container__frame {
    min-height: min(520px, 92vh);
    padding: 24px 20px 20px;
  }

  .auth-container__promise {
    display: none;
  }
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
  gap: var(--space-xl);
  margin-top: var(--space-lg);
}

.auth-container__button {
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
</style>
