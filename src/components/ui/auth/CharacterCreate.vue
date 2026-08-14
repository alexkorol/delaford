<template>
  <div class="character-create">
    <h2 class="character-create__title">Create a Character</h2>
    <p class="character-create__intro">
      Delaford characters have a single, validated identity. Submit the name you would like to use and we'll check it against our
      role-play guidelines. When the name is accepted it becomes bound to your account.
    </p>

    <form
      class="character-create__form"
      @submit.prevent="startValidation"
    >
      <label class="character-create__label">
        Account ID
        <input
          v-model="form.accountId"
          class="character-create__input"
          type="text"
          name="accountId"
          required
          placeholder="e.g. account-12345"
        >
      </label>

      <label class="character-create__label">
        Desired Character Name
        <input
          v-model="form.name"
          class="character-create__input"
          type="text"
          name="name"
          required
          placeholder="Enter your in-world name"
        >
      </label>

      <div class="character-create__actions">
        <button
          class="character-create__button"
          type="submit"
          :disabled="isSubmitting"
        >
          {{ submitLabel }}
        </button>
        <button
          v-if="canRetry"
          class="character-create__button character-create__button--secondary"
          type="button"
          @click="retryValidation"
        >
          Try again
        </button>
      </div>
    </form>

    <div
      v-if="jobStatus"
      class="character-create__status"
      :class="statusVariant"
    >
      <p class="character-create__status-title">{{ statusTitle }}</p>
      <p class="character-create__status-message">{{ statusMessage }}</p>
    </div>

    <div
      v-if="identity"
      class="character-create__identity"
    >
      <h3>Current bound identity</h3>
      <dl>
        <div class="character-create__identity-row">
          <dt>Character name</dt>
          <dd>{{ boundIdentity ? boundIdentity.name : 'Pending' }}</dd>
        </div>
        <div class="character-create__identity-row">
          <dt>Bound at</dt>
          <dd>{{ boundIdentity && boundIdentity.boundAt ? formatDate(boundIdentity.boundAt) : '—' }}</dd>
        </div>
        <div class="character-create__identity-row">
          <dt>Confidence</dt>
          <dd>{{ confidenceLabel }}</dd>
        </div>
      </dl>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CharacterCreate',
  data() {
    return {
      form: {
        accountId: '',
        name: '',
      },
      pollTimer: null,
      job: null,
      jobStatus: '',
      message: '',
      identity: null,
      isSubmitting: false,
    };
  },
  watch: {
    'form.accountId'(value, previous) {
      if (value !== previous) {
        this.identity = null;
      }
    },
  },
  computed: {
    jobResult() {
      return this.job && this.job.result ? this.job.result : null;
    },
    jobError() {
      return this.job && this.job.error ? this.job.error : null;
    },
    boundIdentity() {
      return this.identity && this.identity.boundIdentity ? this.identity.boundIdentity : null;
    },
    submitLabel() {
      if (this.isSubmitting) {
        return 'Validating…';
      }

      if (this.jobStatus === 'complete' && this.jobResult && this.jobResult.valid) {
        return 'Validated';
      }

      return 'Validate name';
    },
    statusVariant() {
      if (this.jobStatus === 'error' || (this.jobStatus === 'complete' && !(this.jobResult && this.jobResult.valid))) {
        return 'character-create__status--error';
      }

      if (this.jobStatus === 'complete' && this.jobResult && this.jobResult.valid) {
        return 'character-create__status--success';
      }

      return 'character-create__status--info';
    },
    statusTitle() {
      switch (this.jobStatus) {
        case 'pending':
          return 'Validation requested';
        case 'complete':
          return this.jobResult && this.jobResult.valid ? 'Name approved' : 'Name rejected';
        case 'error':
          return 'Validation failed';
        default:
          return '';
      }
    },
    statusMessage() {
      if (this.jobStatus === 'complete') {
        return (this.jobResult && this.jobResult.reason) || 'Validation finished.';
      }

      if (this.jobStatus === 'error') {
        return (this.jobError && this.jobError.message) || 'Something went wrong.';
      }

      if (this.jobStatus === 'pending') {
        return 'Hang tight—we are reviewing your name with the moderation model.';
      }

      return this.message;
    },
    canRetry() {
      return this.jobStatus === 'error'
        || (this.jobStatus === 'complete' && !(this.jobResult && this.jobResult.valid));
    },
    confidenceLabel() {
      if (!this.boundIdentity) {
        return '—';
      }

      const { confidence } = this.boundIdentity;
      if (confidence === null || confidence === undefined) {
        return 'Not provided';
      }

      return `${Math.round(confidence * 100)}%`;
    },
  },
  beforeUnmount() {
    this.clearPoll();
  },
  methods: {
    async startValidation() {
      if (this.isSubmitting) {
        return;
      }

      this.isSubmitting = true;
      this.clearPoll();
      this.job = null;
      this.jobStatus = '';
      this.message = '';

      try {
        const response = await fetch('/api/identity/name-validations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: this.form.name,
            accountId: this.form.accountId,
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || 'Unable to request validation');
        }

        this.job = payload;
        this.jobStatus = payload.status;
        this.message = '';

        if (payload.status === 'pending') {
          this.schedulePoll();
        } else if (payload.status === 'complete') {
          await this.handleCompletion(payload);
        }
      } catch (error) {
        this.jobStatus = 'error';
        this.job = {
          jobId: null,
          error: { message: error.message },
        };
      } finally {
        this.isSubmitting = false;
      }
    },
    schedulePoll() {
      this.clearPoll();
      this.pollTimer = window.setTimeout(() => {
        this.pollJob();
      }, 1500);
    },
    clearPoll() {
      if (this.pollTimer) {
        window.clearTimeout(this.pollTimer);
        this.pollTimer = null;
      }
    },
    async pollJob() {
      if (!this.job || !this.job.jobId) {
        return;
      }

      try {
        const response = await fetch(`/api/identity/name-validations/${this.job.jobId}`);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || 'Validation polling failed');
        }

        this.job = payload;
        this.jobStatus = payload.status;

        if (payload.status === 'pending') {
          this.schedulePoll();
        } else if (payload.status === 'complete') {
          await this.handleCompletion(payload);
        } else if (payload.status === 'error') {
          this.clearPoll();
        }
      } catch (error) {
        this.jobStatus = 'error';
        this.job = {
          jobId: this.job && this.job.jobId ? this.job.jobId : null,
          error: { message: error.message },
        };
        this.clearPoll();
      }
    },
    async handleCompletion(payload) {
      this.clearPoll();
      this.jobStatus = payload.status;

      if (payload.status !== 'complete') {
        return;
      }

      if (payload.result && payload.result.valid) {
        await this.refreshIdentity();
      }
    },
    async refreshIdentity() {
      if (!this.form.accountId) {
        return;
      }

      try {
        const response = await fetch(`/api/identity/accounts/${encodeURIComponent(this.form.accountId)}`);
        if (response.status === 404) {
          this.identity = null;
          return;
        }

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || 'Unable to load identity');
        }

        this.identity = payload;
      } catch (error) {
        console.warn('Failed to refresh identity', error);
      }
    },
    retryValidation() {
      this.jobStatus = '';
      this.job = null;
      this.message = '';
    },
    formatDate(value) {
      if (!value) {
        return '—';
      }

      try {
        const date = new Date(value);
        return date.toLocaleString();
      } catch (_error) {
        return value;
      }
    },
  },
};
</script>

<style scoped>
.character-create {
  max-width: 480px;
  margin: 0 auto;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.65);
  border-radius: 8px;
  color: #f8f6f1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.character-create__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  text-align: center;
}

.character-create__intro {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.4;
  text-align: center;
  color: rgba(255, 255, 255, 0.85);
}

.character-create__form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.character-create__label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.character-create__input {
  padding: 0.65rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: rgba(15, 15, 25, 0.85);
  color: inherit;
}

.character-create__input:focus {
  outline: none;
  border-color: #f3b15b;
  box-shadow: 0 0 0 1px rgba(243, 177, 91, 0.4);
}

.character-create__actions {
  display: flex;
  gap: 0.75rem;
}

.character-create__button {
  flex: 1;
  padding: 0.65rem 1rem;
  border: none;
  border-radius: 4px;
  background: linear-gradient(90deg, #f3b15b 0%, #d47a25 100%);
  color: #1b1006;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.1s ease, opacity 0.1s ease;
}

.character-create__button:disabled {
  cursor: default;
  opacity: 0.6;
  transform: none;
}

.character-create__button:not(:disabled):hover {
  transform: translateY(-1px);
}

.character-create__button--secondary {
  background: rgba(255, 255, 255, 0.15);
  color: #f8f6f1;
}

.character-create__status {
  padding: 1rem;
  border-radius: 6px;
  font-size: 0.95rem;
}

.character-create__status--info {
  background: rgba(72, 106, 164, 0.2);
  border: 1px solid rgba(72, 106, 164, 0.4);
}

.character-create__status--success {
  background: rgba(72, 164, 117, 0.2);
  border: 1px solid rgba(72, 164, 117, 0.4);
}

.character-create__status--error {
  background: rgba(164, 72, 72, 0.2);
  border: 1px solid rgba(164, 72, 72, 0.4);
}

.character-create__status-title {
  margin: 0 0 0.5rem;
  font-weight: 700;
}

.character-create__status-message {
  margin: 0;
}

.character-create__identity {
  background: rgba(0, 0, 0, 0.35);
  border-radius: 6px;
  padding: 1rem;
}

.character-create__identity h3 {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
}

.character-create__identity-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.character-create__identity-row dt {
  font-weight: 600;
}

.character-create__identity-row dd {
  margin: 0;
  text-align: right;
}
</style>
