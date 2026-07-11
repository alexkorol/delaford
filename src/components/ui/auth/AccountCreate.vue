<template>
  <div class="account-create">
    <div>
      <h2>Join the Chronicle</h2>
      <p>Create one account, then found a persistent House and send mortal scions into the depths.</p>
    </div>

    <form @submit.prevent="createAccount">
      <label for="register-username">Username</label>
      <input
        id="register-username"
        v-model.trim="username"
        autocomplete="username"
        maxlength="24"
        pattern="[A-Za-z0-9_-]{3,24}"
        required
      >

      <label for="register-password">Password</label>
      <input
        id="register-password"
        v-model="password"
        type="password"
        autocomplete="new-password"
        minlength="8"
        maxlength="128"
        required
      >

      <label for="register-confirm">Confirm password</label>
      <input
        id="register-confirm"
        v-model="confirmation"
        type="password"
        autocomplete="new-password"
        minlength="8"
        maxlength="128"
        required
      >

      <p v-if="error" class="account-create__error" role="alert">{{ error }}</p>

      <div class="account-create__actions">
        <button type="submit" :disabled="submitting">
          {{ submitting ? 'Founding…' : 'Create account' }}
        </button>
        <button type="button" class="account-create__secondary" @click="$emit('cancel')">Back</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const emit = defineEmits(['cancel', 'registered']);
const username = ref('');
const password = ref('');
const confirmation = ref('');
const error = ref('');
const submitting = ref(false);

const createAccount = async () => {
  if (submitting.value) return;
  error.value = '';
  if (password.value !== confirmation.value) {
    error.value = 'Passwords do not match.';
    return;
  }
  submitting.value = true;
  try {
    const response = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || 'Could not create that account.');
    window.sessionStorage.setItem('verdigris_registered_username', payload.username);
    emit('registered', payload);
  } catch (cause) {
    error.value = cause.message || 'Could not create that account.';
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped lang="scss">
@use '@/assets/scss/abstracts/tokens' as *;

.account-create {
  display: grid;
  gap: var(--space-lg);
  max-width: 440px;
  margin: auto;
  color: var(--color-text-primary);

  h2 {
    margin: 0 0 var(--space-xs);
    font-family: 'GameFont', sans-serif;
    color: #e2c477;
  }

  p {
    margin: 0;
    line-height: 1.5;
    color: var(--color-text-secondary);
  }

  form {
    display: grid;
    gap: var(--space-sm);
  }

  label {
    font-family: 'ChatFont', sans-serif;
    color: #d9c8a6;
  }

  input {
    padding: 0.7rem 0.75rem;
    color: #f4e4bd;
    background: rgba(8, 6, 5, 0.65);
    border: 1px solid rgba(212, 173, 90, 0.5);
  }

  input:focus {
    outline: 2px solid var(--color-accent-strong);
    outline-offset: 1px;
  }

  button {
    padding: 0.65rem 1rem;
    font-family: 'GameFont', sans-serif;
    color: #f7eeda;
    background: linear-gradient(180deg, #84704c, #4b3b27);
    border: 1px solid #b19054;
    cursor: pointer;
  }

  button:disabled {
    cursor: wait;
    opacity: 0.65;
  }
}

.account-create__actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.account-create__secondary {
  background: rgba(20, 17, 13, 0.8) !important;
}

.account-create__error {
  color: #ffaaa0 !important;
}
</style>
