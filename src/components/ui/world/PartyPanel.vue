<template>
  <div class="party-panel">
    <header class="party-panel__header">
      <span class="party-panel__title">Party</span>
      <span
        v-if="loading && loading.active"
        class="party-panel__status"
      >
        {{ loadingLabel }}
      </span>
    </header>

    <section
      v-if="invites && invites.length"
      class="party-panel__invites"
    >
      <div
        v-for="invite in invites"
        :key="invite.partyId"
        class="party-panel__invite"
      >
        <span class="party-panel__invite-text">
          Invite from {{ invite.invitedBy || 'Unknown' }}
        </span>
        <div class="party-panel__invite-actions">
          <button
            type="button"
            class="party-panel__button party-panel__button--positive"
            @click="$emit('accept-invite', invite)"
          >
            Accept
          </button>
          <button
            type="button"
            class="party-panel__button party-panel__button--negative"
            @click="$emit('decline-invite', invite)"
          >
            Decline
          </button>
        </div>
      </div>
    </section>

    <section
      v-if="statusMessage"
      class="party-panel__status-message"
    >
      {{ statusMessage }}
    </section>

    <section
      v-if="party"
      class="party-panel__body"
    >
      <ul class="party-panel__members">
        <li
          v-for="member in party.members"
          :key="member.uuid"
          class="party-panel__member"
          :class="{
            'party-panel__member--ready': member.ready,
            'party-panel__member--leader': member.uuid === party.leaderId,
          }"
        >
          <span class="party-panel__member-name">{{ member.username }}</span>
          <span class="party-panel__member-status">
            {{ member.ready ? 'Ready' : 'Not ready' }}
          </span>
        </li>
      </ul>

      <div class="party-panel__actions">
        <button
          type="button"
          class="party-panel__button"
          @click="$emit('toggle-ready')"
        >
          {{ isReady ? 'Set not ready' : 'Ready up' }}
        </button>
        <button
          v-if="isLeader"
          type="button"
          class="party-panel__button"
          :disabled="!allReady || !canStartInstance"
          @click="$emit('start-instance')"
        >
          Start instance
        </button>
        <button
          v-if="canReturnToTown"
          type="button"
          class="party-panel__button"
          @click="$emit('return-to-town')"
        >
          Return to town
        </button>
        <button
          type="button"
          class="party-panel__button party-panel__button--negative"
          @click="$emit('leave')"
        >
          Leave party
        </button>
      </div>

      <div
        v-if="isLeader"
        class="party-panel__invite-form"
      >
        <input
          v-model="inviteName"
          type="text"
          class="party-panel__input"
          placeholder="Invite player by name"
          @keyup.enter="submitInvite"
        >
        <button
          type="button"
          class="party-panel__button"
          @click="submitInvite"
        >
          Invite
        </button>
      </div>
    </section>

    <section
      v-else
      class="party-panel__empty"
    >
      <p class="party-panel__empty-text">
        No active party.
      </p>
      <button
        type="button"
        class="party-panel__button"
        @click="$emit('create')"
      >
        Create party
      </button>
    </section>
  </div>
</template>

<script>
export default {
  name: 'PartyPanel',
  props: {
    playerId: {
      type: String,
      default: null,
    },
    party: {
      type: Object,
      default: null,
    },
    invites: {
      type: Array,
      default: () => [],
    },
    loading: {
      type: Object,
      default: () => ({ active: false, state: null }),
    },
    statusMessage: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      inviteName: '',
    };
  },
  computed: {
    isLeader() {
      return Boolean(this.party && this.party.leaderId === this.playerId);
    },
    isReady() {
      if (!this.party) {
        return false;
      }
      const member = this.party.members.find(m => m.uuid === this.playerId);
      return Boolean(member && member.ready);
    },
    allReady() {
      if (!this.party) {
        return false;
      }
      return this.party.members.length > 0 && this.party.members.every(member => member.ready);
    },
    canStartInstance() {
      return Boolean(this.party && this.party.state === 'lobby');
    },
    canReturnToTown() {
      if (!this.party || !this.isLeader) {
        return false;
      }
      return ['instance', 'instance-complete'].includes(this.party.state);
    },
    loadingLabel() {
      if (!this.loading || !this.loading.state) {
        return 'Loading';
      }
      const mapping = {
        'enter-instance': 'Entering instance...',
        'distribute-rewards': 'Distributing rewards...',
        'return-instance': 'Returning to town...',
        idle: 'Idle',
      };
      return mapping[this.loading.state] || 'Loading';
    },
  },
  methods: {
    submitInvite() {
      const candidate = this.inviteName.trim();
      if (!candidate) {
        return;
      }

      this.$emit('invite', { username: candidate });
      this.inviteName = '';
    },
  },
};
</script>

<style scoped>
.party-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  color: var(--color-text-primary);
  background:
    linear-gradient(90deg, rgba(113, 34, 38, 0.08), transparent 48%, rgba(39, 69, 90, 0.1)),
    var(--panel-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: 0;
  outline: 1px solid #080706;
  outline-offset: -4px;
  box-shadow: var(--shadow-strong), inset 0 0 24px rgba(0, 0, 0, 0.52);
  font-family: 'GameFont', sans-serif;
}

.party-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 27px;
  padding: 2px 6px 6px;
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--color-accent-strong);
  border-bottom: 1px solid rgba(183, 146, 79, 0.38);
}

.party-panel__title { font-weight: normal; }

.party-panel__status {
  font-size: 0.62rem;
  color: var(--color-sapphire-light);
}

.party-panel__invites,
.party-panel__body,
.party-panel__members {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.party-panel__invite {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px;
  background: var(--color-bg-inset);
  border: 1px solid var(--color-border);
}

.party-panel__invite-text,
.party-panel__members { font-size: 0.72rem; }

.party-panel__invite-actions {
  display: flex;
  gap: 4px;
}

.party-panel__status-message {
  padding: 5px 7px;
  font-size: 0.7rem;
  color: var(--color-ruby-light);
  background: rgba(102, 30, 35, 0.2);
  border-left: 2px solid var(--color-ruby);
}

.party-panel__members {
  list-style: none;
  margin: 0;
  padding: 0;
}

.party-panel__member {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 26px;
  padding: 4px 7px;
  background: var(--color-bg-inset);
  border: 1px solid rgba(183, 146, 79, 0.18);
}

.party-panel__member--ready {
  color: #d8ead9;
  border-color: rgba(94, 147, 104, 0.62);
  box-shadow: inset 2px 0 0 rgba(94, 147, 104, 0.72);
}

.party-panel__member--leader::before {
  content: '◆';
  color: var(--color-accent-strong);
  margin-right: 5px;
  font-size: 0.58rem;
}

.party-panel__member-name { font-weight: normal; }

.party-panel__member-status {
  font-size: 0.62rem;
  color: var(--color-text-dim);
}

.party-panel__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
}

.party-panel__button {
  min-height: 28px;
  padding: 5px 8px;
  background: var(--control-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-frame-dark);
  border-top-color: rgba(218, 184, 112, 0.34);
  border-radius: 0;
  font: 0.67rem 'GameFont', sans-serif;
  cursor: pointer;
}

.party-panel__button:hover {
  color: #fff0c2;
  border-color: var(--color-frame-light);
  background: var(--control-surface-hover);
}

.party-panel__button:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.party-panel__button--negative {
  color: #dcb0aa;
  border-color: rgba(139, 48, 52, 0.52);
  background: linear-gradient(180deg, #452126, #1d1012);
}

.party-panel__button--negative:hover {
  color: #f1c1b8;
  border-color: var(--color-ruby-light);
  background: linear-gradient(180deg, #59292f, #241214);
}

.party-panel__button--positive {
  color: #d4ead8;
  border-color: rgba(94, 147, 104, 0.54);
  background: linear-gradient(180deg, #29452e, #142318);
}

.party-panel__button--positive:hover {
  color: #e3f4e6;
  border-color: #76a87f;
  background: linear-gradient(180deg, #34583a, #182b1d);
}

.party-panel__invite-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px;
}

.party-panel__input {
  min-width: 0;
  padding: 5px 7px;
  background: var(--color-bg-inset);
  border: 1px solid var(--color-border);
  border-radius: 0;
  color: var(--color-text-primary);
  font: 0.68rem 'ChatFont', sans-serif;
}

.party-panel__input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.party-panel__empty {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.party-panel__empty-text {
  margin: 0;
  font-size: 0.72rem;
  color: var(--color-text-secondary);
}
</style>
