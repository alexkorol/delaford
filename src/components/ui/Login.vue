<template>
  <div class="form">
    <button
      class="button play_guest"
      :disabled="isLoginInProgress"
      @click="playAsGuest"
    >
      {{ isLoginInProgress && guestAccount ? 'Entering Delaford…' : 'Play as Guest' }}
    </button>
    <p class="guest_hint">
      No account needed — your progress is saved on this server.
    </p>

    <div class="divider">
      <span>or sign in with an account</span>
    </div>

    <div
      v-tippy
      title="Load pre-made guest account. Guest progress is saved on this server."
      class="checkbox guest_account"
    >
      <label for="guest_account">
        <input
          id="guest_account"
          v-model="guestAccount"
          type="checkbox"
          @change="toggleGuestAccount"
        >
        Guest account?
      </label>
    </div>
    <div class="inputs">
      <form
        :class="{ hasErrors: invalid }"
        autocomplete="off"
        @submit.prevent="login"
      >
        <label for="login-username" class="sr-only">Username</label>
        <input
          id="login-username"
          ref="usernameField"
          v-model="username"
          placeholder="Username"
          type="text"
          class="username"
          autocorrect="off"
          spellcheck="false"
          autocomplete="off"
        >
        <label for="login-password" class="sr-only">Password</label>
        <input
          id="login-password"
          v-model="password"
          placeholder="Password"
          type="password"
          class="password"
          autocomplete="off"
        >
      </form>

      <div
        v-if="invalid"
        class="error_message"
      >
        Incorrect login. Please try again.
      </div>
    </div>

    <div class="action_buttons">
      <button
        class="button login"
        :disabled="isLoginInProgress"
        @click="login"
      >
        {{ isLoginInProgress && !guestAccount ? 'Signing in…' : 'Login' }}
      </button>
      <div
        v-if="inDevelopment"
        v-tippy
        title="Dev account details will be saved and auto-logged in upon code changes."
        class="checkbox"
      >
        <label for="rememberMe">
          <input
            id="rememberMe"
            v-model="rememberMe"
            type="checkbox"
            @change="toggleRememberMe"
          >
          Remember me?
        </label>
      </div>
      <button
        class="button"
        @click="cancel"
      >
        Cancel
      </button>
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

import { useUiStore } from '@/stores/ui.js';

import bus from '../../core/utilities/bus.js';
import Socket from '../../core/utilities/socket.js';
import { startBrowserGuestSession } from '../../core/auth/guest-session.js';

const uiStore = useUiStore();

const invalid = ref(false);
const username = ref('');
const password = ref('');
const guestAccount = ref(false);
const rememberMe = ref(false);
const isLoginInProgress = ref(false);
const usernameField = ref(null);

const inDevelopment = computed(() => !import.meta.env.PROD);

const setLoginProgress = (value) => {
  isLoginInProgress.value = value;
};

const applyGuestCredentials = (value) => {
  if (value) {
    username.value = 'dev';
    password.value = 'qwertykeyboard';
  } else {
    username.value = '';
    password.value = '';
  }
};

watch(
  guestAccount,
  (value) => {
    applyGuestCredentials(value);
  },
  { immediate: false },
);

const toggleGuestAccount = () => {
  uiStore.setGuestAccount(guestAccount.value);
};

const toggleRememberMe = () => {
  uiStore.setRememberMe(rememberMe.value);
  const url = rememberMe.value
    ? `${window.location.origin}/?#autologin`
    : window.location.origin;
  window.history.pushState('Page', 'Title', url);
};

const introduceMusic = () => {
  bus.emit('music:start');
};

const cancel = () => {
  bus.emit('go:main');
};

// ?play: one URL from zero to playing. Each browser carries its own guest
// chronicle (crypto-random guestId), entering through the chronicle-auth
// quick-guest flow straight into a populated world.
const quickPlay = () => {
  if (isLoginInProgress.value) return;
  setLoginProgress(true);
  startBrowserGuestSession({ quickStart: true });
};

const incorrectLogin = () => {
  setLoginProgress(false);
  invalid.value = true;
};

const login = () => {
  if (isLoginInProgress.value) return;
  setLoginProgress(true);
  invalid.value = false;
  const data = {
    username: username.value,
    password: password.value,
    useGuestAccount: guestAccount.value,
  };

  uiStore.rememberDevAccount({
    username: username.value,
    password: password.value,
  });
  Socket.emit('player:login', data);
};

// One click from the title screen to Chronicles. Each browser owns a secure
// guest identity; the explicit developer "Guest account?" checkbox below is
// the only path that should load the old shared dev profile.
const playAsGuest = () => {
  if (isLoginInProgress.value) return;
  guestAccount.value = true;
  uiStore.setGuestAccount(true);
  setLoginProgress(true);
  startBrowserGuestSession();
};

const handleLoginError = () => incorrectLogin();
const handleLoginComplete = () => setLoginProgress(false);

onMounted(() => {
  invalid.value = false;

  if (new URLSearchParams(window.location.search).has('play')
    && !window.__verdigrisQuickPlayConsumed) {
    // The component can remount after logout/session replacement. Auto-play
    // is a page-entry promise, not permission to steal the scion back from a
    // newer tab. A full reload gets a fresh window and may auto-play again.
    window.__verdigrisQuickPlayConsumed = true;
    setTimeout(quickPlay, 50);
    return;
  }

  const tempGuest = window.location.href.includes('?useGuestAccount');

  rememberMe.value = uiStore.rememberMe;
  guestAccount.value = tempGuest || uiStore.guestAccount;

  bus.on('player:login-error', handleLoginError);
  bus.on('login:done', handleLoginComplete);

  if (guestAccount.value && import.meta.env.DEV) {
    applyGuestCredentials(true);
  }

  const storedAccount = uiStore.account;
  if (storedAccount?.username) {
    username.value = storedAccount.username;
    password.value = storedAccount.password;
    if (window.location.href.includes('#autologin')) {
      setTimeout(() => document.querySelector('button.login')?.click(), 250);
    }
  }

  nextTick(() => {
    usernameField.value?.focus();
  });
});

onBeforeUnmount(() => {
  bus.off('player:login-error', handleLoginError);
  bus.off('login:done', handleLoginComplete);
});
</script>

<style lang="scss" scoped>
@use "@/assets/scss/main" as *;

div.form {
  width: 100%;

  .play_guest {
    width: 100%;
    font-family: 'GameFont', sans-serif;
    font-size: 1.25rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #f7eeda;
    text-shadow: 0 2px 0 rgba(0, 0, 0, 0.85);
    background: linear-gradient(180deg, #5f7a4a 0%, #42582f 55%, #2f4220 100%);
    border: 2px solid #141c0d;
    border-top-color: rgba(200, 230, 160, 0.6);
    border-left-color: rgba(200, 230, 160, 0.35);
    border-radius: 0;
    padding: 0.65em var(--space-xl);
    cursor: pointer;
    box-shadow:
      0 4px 10px rgba(0, 0, 0, 0.45),
      0 0 16px rgba(140, 190, 100, 0.2),
      inset 0 0 12px rgba(0, 0, 0, 0.25);

    &:disabled {
      opacity: 0.7;
      cursor: wait;
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent-strong);
      outline-offset: 2px;
    }

    &:hover:not(:disabled) {
      background: linear-gradient(180deg, #6d8a55 0%, #4d6538 55%, #374a26 100%);
      box-shadow:
        0 4px 10px rgba(0, 0, 0, 0.45),
        0 0 22px rgba(140, 190, 100, 0.35),
        inset 0 0 12px rgba(0, 0, 0, 0.25);
    }

    &:active:not(:disabled) {
      transform: translateY(1px);
    }
  }

  .guest_hint {
    margin: 0.6em 0 0;
    text-align: center;
    color: rgba(230, 216, 186, 0.75);
    font-family: "ChatFont", sans-serif;
    font-size: 0.95rem;
    text-shadow: 1px 1px 0 #000;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 0.8em;
    margin: 1.1em 0 0.4em;
    color: rgba(230, 216, 186, 0.6);
    font-family: "ChatFont", sans-serif;
    font-size: 0.9rem;
    text-shadow: 1px 1px 0 #000;

    &::before,
    &::after {
      content: "";
      flex: 1;
      border-top: 1px solid rgba(190, 160, 110, 0.35);
    }
  }

  form {
    display: flex;
    flex-direction: column;

    input {
      font-size: 14pt;
      outline: none;
      padding: 6px 8px;
      background: rgba(8, 6, 5, 0.45);
      border-style: solid;
      color: #f2d88f;
      caret-color: #f2d88f;
      border-color: rgba(212, 173, 90, 0.55);
      border-width: 0 0 2px 0;
      margin-bottom: 1em;
      font-family: "ChatFont", sans-serif;
      text-shadow: 1px 1px 0 #000;

      &::placeholder {
        color: rgba(228, 214, 188, 0.55);
      }

      &:last-child {
        margin-bottom: 0;
      }

      &:focus {
        background: rgba(212, 173, 90, 0.07);
        border-bottom-color: var(--color-accent-strong);
        box-shadow: 0 10px 18px -12px rgba(212, 173, 90, 0.45);
      }
    }
  }

  form.hasErrors {
    input {
      background: rgba(204, 58, 58, 0.12);
      border-bottom-color: var(--color-danger);
    }
  }

  .error_message {
    margin-top: 1em;
    background: rgba(96, 22, 22, 0.85);
    border: 1px solid rgba(204, 58, 58, 0.7);
    padding: 0.4em 0.6em;
    color: #f0d8d2;
    font-family: "ChatFont", sans-serif;
    text-shadow: 1px 1px 0 #000;
  }

  .action_buttons {
    display: inline-flex;
    width: 100%;
    margin-top: 1.25em;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-md);

    button {
      font-family: 'GameFont', sans-serif;
      font-size: 1.1rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #f7eeda;
      text-shadow: 0 2px 0 rgba(0, 0, 0, 0.85);
      background: linear-gradient(180deg, #84704c 0%, #5a4830 55%, #443723 100%);
      border: 2px solid #20180d;
      border-top-color: rgba(238, 216, 166, 0.55);
      border-left-color: rgba(238, 216, 166, 0.35);
      border-radius: 0;
      padding: var(--space-sm) var(--space-xl);
      cursor: pointer;
      box-shadow:
        0 4px 10px rgba(0, 0, 0, 0.45),
        inset 0 0 12px rgba(0, 0, 0, 0.25);

      &:focus-visible {
        outline: 2px solid var(--color-accent-strong);
        outline-offset: 2px;
      }

      &:disabled {
        opacity: 0.7;
        cursor: wait;
      }

      &:hover:not(:disabled) {
        background: linear-gradient(180deg, #97825a 0%, #6a5538 55%, #4e3f28 100%);
        box-shadow:
          0 4px 10px rgba(0, 0, 0, 0.45),
          0 0 14px rgba(212, 173, 90, 0.25),
          inset 0 0 12px rgba(0, 0, 0, 0.25);
      }

      &:active:not(:disabled) {
        transform: translateY(1px);
        border-top-color: #20180d;
        border-left-color: #20180d;
        border-bottom-color: rgba(230, 205, 150, 0.3);
      }
    }
  }

  .checkbox {
    display: inline-flex;
    width: fit-content;
    background: rgba(30, 25, 19, 0.9);
    border: 1px solid rgba(190, 160, 110, 0.5);
    color: #e6d8ba;
    margin-top: 0.25em;
    padding: 0.3em 0.55em;
    font-family: "ChatFont", sans-serif;
    text-shadow: 1px 1px 0 #000;

    label {
      display: flex;
      align-items: center;
      gap: 0.45em;
      cursor: pointer;
    }

    input[type='checkbox'] {
      accent-color: var(--color-accent);
    }
  }

  .guest_account {
    margin-top: 1em;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
}
</style>
