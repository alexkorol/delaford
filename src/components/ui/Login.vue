<template>
  <div class="form">
    <div
      v-tippy
      title="Load pre-made guest account. No progress will be saved on this account."
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
        @click="login"
      >
        Login
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

const uiStore = useUiStore();

const invalid = ref(false);
const username = ref('');
const password = ref('');
const guestAccount = ref(false);
const rememberMe = ref(false);
const isLoginInProgress = ref(false);
const usernameField = ref(null);

const inDevelopment = computed(() => !import.meta.env.PROD);
const GUEST_ID_KEY = 'verdigris_guest_id';

const getGuestId = () => {
  const existing = window.localStorage.getItem(GUEST_ID_KEY);
  if (existing) return existing;
  const generated = globalThis.crypto?.randomUUID?.()
    || `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(GUEST_ID_KEY, generated);
  return generated;
};

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
    ...(guestAccount.value ? { guestId: getGuestId() } : {}),
  };

  uiStore.rememberDevAccount({
    username: username.value,
    password: password.value,
  });
  Socket.emit('player:login', data);
};

const handleLoginError = () => incorrectLogin();
const handleLoginComplete = () => setLoginProgress(false);

onMounted(() => {
  invalid.value = false;

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
