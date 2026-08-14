<template>
  <div class="login-form">
    <section class="login-form__entry">
      <p class="login-form__kicker">Begin a living Chronicle</p>
      <button
        class="login-form__guest play_guest login"
        aria-label="Play as Guest"
        :disabled="isLoginInProgress"
        @click="playAsGuest"
      >
        <span>{{ isLoginInProgress ? 'Entering Delaford...' : 'Play as Guest' }}</span>
        <small>One click. Your own persistent House.</small>
      </button>
      <p class="login-form__hint">
        No account needed. Your House and Scions stay with this browser.
      </p>
    </section>

    <button
      class="login-form__account-toggle"
      type="button"
      :aria-expanded="accountExpanded"
      aria-controls="account-sign-in"
      @click="toggleAccountPanel"
    >
      <span>Sign in to an existing account</span>
      <span aria-hidden="true">{{ accountExpanded ? '-' : '+' }}</span>
    </button>

    <section
      v-if="accountExpanded"
      id="account-sign-in"
      class="login-form__account"
      aria-label="Account sign in"
    >
      <div
        v-if="inDevelopment"
        class="login-form__dev-account"
      >
        <label for="guest_account">
          <input
            id="guest_account"
            v-model="guestAccount"
            type="checkbox"
            @change="toggleGuestAccount"
          >
          Use the shared developer profile
        </label>
      </div>

      <form
        :class="{ 'login-form__fields--invalid': invalid }"
        class="login-form__fields"
        autocomplete="off"
        @submit.prevent="login"
      >
        <label for="login-username">Account name</label>
        <input
          id="login-username"
          ref="usernameField"
          v-model="username"
          placeholder="Account name"
          type="text"
          class="username"
          autocorrect="off"
          spellcheck="false"
          autocomplete="off"
        >
        <label for="login-password">Password</label>
        <input
          id="login-password"
          v-model="password"
          placeholder="Password"
          type="password"
          class="password"
          autocomplete="off"
        >
        <p
          v-if="invalid"
          class="login-form__error"
          role="alert"
        >
          That account could not be opened. Check the name and password.
        </p>
        <div class="login-form__account-actions">
          <button
            class="login-form__login"
            type="submit"
            :disabled="isLoginInProgress"
          >
            {{ isLoginInProgress ? 'Signing in...' : 'Enter the Chronicles' }}
          </button>
          <label
            v-if="inDevelopment"
            class="login-form__remember"
            for="rememberMe"
          >
            <input
              id="rememberMe"
              v-model="rememberMe"
              type="checkbox"
              @change="toggleRememberMe"
            >
            Remember locally
          </label>
        </div>
      </form>
    </section>
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
const accountExpanded = ref(false);
const usernameField = ref(null);

const inDevelopment = computed(() => !import.meta.env.PROD);

const setLoginProgress = value => { isLoginInProgress.value = value; };

const applyGuestCredentials = (value) => {
  if (value) {
    username.value = 'dev';
    password.value = 'qwertykeyboard';
  } else {
    username.value = '';
    password.value = '';
  }
};

watch(guestAccount, value => applyGuestCredentials(value));

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

const toggleAccountPanel = () => {
  accountExpanded.value = !accountExpanded.value;
  if (accountExpanded.value) {
    nextTick(() => usernameField.value?.focus());
  }
};

const quickPlay = () => {
  if (isLoginInProgress.value) return;
  setLoginProgress(true);
  startBrowserGuestSession({ quickStart: true });
};

const incorrectLogin = () => {
  setLoginProgress(false);
  invalid.value = true;
  accountExpanded.value = true;
};

const login = () => {
  if (isLoginInProgress.value) return;
  setLoginProgress(true);
  invalid.value = false;
  uiStore.rememberDevAccount({ username: username.value, password: password.value });
  Socket.emit('player:login', {
    username: username.value,
    password: password.value,
    useGuestAccount: guestAccount.value,
  });
};

// Browser guests and the shared developer profile are separate flows. The old
// screen persisted the developer toggle when this primary CTA was used, then
// reopened looking like a credential-filled debug form.
const playAsGuest = () => {
  if (isLoginInProgress.value) return;
  guestAccount.value = false;
  uiStore.setGuestAccount(false);
  setLoginProgress(true);
  startBrowserGuestSession();
};

const handleLoginError = () => incorrectLogin();
const handleLoginComplete = () => setLoginProgress(false);

onMounted(() => {
  invalid.value = false;

  if (new URLSearchParams(window.location.search).has('play')
    && !window.__verdigrisQuickPlayConsumed) {
    window.__verdigrisQuickPlayConsumed = true;
    setTimeout(quickPlay, 50);
    return;
  }

  const tempGuest = window.location.href.includes('?useGuestAccount');
  rememberMe.value = uiStore.rememberMe;
  guestAccount.value = tempGuest || uiStore.guestAccount;

  bus.on('player:login-error', handleLoginError);
  bus.on('login:done', handleLoginComplete);

  if (guestAccount.value && import.meta.env.DEV) applyGuestCredentials(true);

  const storedAccount = uiStore.account;
  if (storedAccount?.username) {
    username.value = storedAccount.username;
    password.value = storedAccount.password;
    if (window.location.href.includes('#autologin')) {
      accountExpanded.value = true;
      setTimeout(() => document.querySelector('.login-form__login')?.click(), 250);
    }
  }
});

onBeforeUnmount(() => {
  bus.off('player:login-error', handleLoginError);
  bus.off('login:done', handleLoginComplete);
});
</script>

<style lang="scss" scoped>
@use '@/assets/scss/abstracts/tokens' as *;

.login-form {
  width: 100%;
}

.login-form__entry {
  text-align: center;
}

.login-form__kicker {
  margin: 0 0 9px;
  color: rgba(234, 219, 187, 0.7);
  font: 0.7rem 'ChatFont', sans-serif;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.login-form__guest {
  position: relative;
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 13px 24px 11px;
  color: #112119;
  font-family: 'GameFont', sans-serif;
  font-size: clamp(1.05rem, 2.5vw, 1.35rem);
  letter-spacing: 0.09em;
  text-transform: uppercase;
  text-shadow: 0 1px rgba(255, 255, 255, 0.25);
  background:
    linear-gradient(180deg, rgba(202, 238, 218, 0.22), transparent 42%),
    linear-gradient(180deg, #86c2aa, #579780 58%, #376d5c);
  border: 1px solid #b9e2cf;
  box-shadow:
    0 0 0 2px #15251e,
    0 0 24px rgba(95, 168, 147, 0.22),
    inset 0 1px rgba(255, 255, 255, 0.35),
    inset 0 -8px 18px rgba(13, 47, 36, 0.28);
  cursor: pointer;

  small {
    color: rgba(13, 35, 26, 0.72);
    font: 0.61rem 'ChatFont', sans-serif;
    letter-spacing: 0.08em;
  }

  &:disabled {
    cursor: wait;
    opacity: 0.62;
  }

  &:focus-visible {
    outline: 2px solid #f0d486;
    outline-offset: 4px;
  }

  &:hover:not(:disabled) {
    filter: brightness(1.1) saturate(1.06);
    box-shadow:
      0 0 0 2px #15251e,
      0 0 32px rgba(95, 168, 147, 0.38),
      inset 0 1px rgba(255, 255, 255, 0.4);
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }
}

.login-form__hint {
  margin: 10px 0 0;
  color: rgba(226, 214, 190, 0.68);
  font: 0.73rem 'ChatFont', sans-serif;
  line-height: 1.45;
}

.login-form__account-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-top: 24px;
  padding: 9px 12px;
  color: rgba(225, 208, 174, 0.7);
  font: 0.69rem 'ChatFont', sans-serif;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: rgba(9, 9, 8, 0.64);
  border: 1px solid rgba(174, 141, 80, 0.3);
  cursor: pointer;

  span:last-child {
    color: #75bda6;
    font-size: 1rem;
  }

  &:hover {
    color: #f0d486;
    border-color: rgba(95, 168, 147, 0.6);
  }

  &:focus-visible {
    outline: 2px solid #8bd2bc;
    outline-offset: 2px;
  }
}

.login-form__account {
  padding: 14px 14px 4px;
  background: rgba(8, 8, 7, 0.5);
  border: 1px solid rgba(174, 141, 80, 0.2);
  border-top: 0;
}

.login-form__dev-account,
.login-form__remember {
  color: rgba(220, 207, 181, 0.66);
  font: 0.66rem 'ChatFont', sans-serif;

  label,
  & {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  input { accent-color: #5fa893; }
}

.login-form__dev-account { margin-bottom: 12px; }

.login-form__fields--invalid > input {
  border-color: #b85f4f;
}

.login-form__fields {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 7px 10px;
  align-items: center;

  > label {
    color: rgba(223, 207, 176, 0.6);
    font: 0.65rem 'ChatFont', sans-serif;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  > input {
    min-width: 0;
    padding: 9px 10px;
    color: #f3dfaa;
    font: 0.8rem 'ChatFont', sans-serif;
    background: rgba(4, 4, 4, 0.76);
    border: 1px solid rgba(145, 119, 73, 0.5);
    outline: 0;

    &:focus {
      border-color: #68af98;
      box-shadow: 0 0 0 1px rgba(104, 175, 152, 0.25);
    }
  }
}

.login-form__error {
  grid-column: 1 / -1;
  margin: 4px 0 0;
  padding: 7px 9px;
  color: #efb0a2;
  font: 0.68rem 'ChatFont', sans-serif;
  background: rgba(100, 27, 20, 0.32);
  border: 1px solid rgba(202, 91, 70, 0.4);
}

.login-form__account-actions {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 7px;
}

.login-form__login {
  padding: 9px 14px;
  color: #f5e8ca;
  font: 0.75rem 'GameFont', sans-serif;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  background: linear-gradient(#6e5b39, #3d301d);
  border: 1px solid #aa8c53;
  cursor: pointer;

  &:disabled {
    cursor: wait;
    opacity: 0.55;
  }

  &:focus-visible {
    outline: 2px solid #8bd2bc;
    outline-offset: 2px;
  }

  &:hover:not(:disabled) {
    filter: brightness(1.14);
  }
}

@media (width <= 580px) {
  .login-form__fields {
    grid-template-columns: 1fr;
  }

  .login-form__account-actions {
    grid-column: 1;
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
