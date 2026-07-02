<template>
  <section
    class="chatbox"
    :class="chatboxClasses"
    @mouseenter="$emit('hover-state', true)"
    @mouseleave="$emit('hover-state', false)"
    @click.stop="focusInput"
  >
    <header class="chatbox__header">
      <div class="chatbox__meta">
        <h2 class="chatbox__title">Chat</h2>
        <p
          v-if="showCountdown"
          class="chatbox__countdown"
        >
          Hiding in {{ countdownLabel }}
        </p>
      </div>
      <div class="chatbox__actions">
        <span
          v-if="collapsed && unreadCount > 0"
          class="chatbox__badge"
          aria-live="polite"
        >
          {{ unreadCount }}
        </span>
        <button
          class="chatbox__pin"
          type="button"
          @click="$emit('toggle-pin')"
        >
          {{ pinned ? 'Unpin' : 'Pin' }}
        </button>
      </div>
    </header>

    <div
      ref="messageList"
      class="chatbox__messages"
    >
      <ul class="chatbox__list">
        <li
          v-for="(message, index) in messages"
          :key="`${message.timestamp}-${index}`"
          class="chatbox__message"
        >
          <span
            v-if="message.username"
            class="chatbox__username"
          >
            {{ message.username }}:
          </span>
          <span
            class="chatbox__text"
            :style="message.colorStyle || ''"
          >{{ message.displayText }}</span>
          <span class="chatbox__time">{{ message.displayTime }}</span>
        </li>
      </ul>
    </div>

    <form
      class="chatbox__form"
      @submit.prevent="sendMessage"
    >
      <input
        ref="input"
        v-model="said"
        class="chatbox__input"
        type="text"
        autocomplete="off"
        maxlength="120"
        placeholder="Say something..."
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown.escape.stop="blurAndRefocusGame"
      >
      <button
        class="chatbox__submit"
        type="submit"
      >
        Send
      </button>
    </form>
  </section>
</template>

<script>
import Socket from '../core/utilities/socket.js';
import bus from '../core/utilities/bus.js';
import { normaliseChatMessage } from '../core/chat-message.js';

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default {
  name: 'Chatbox',
  props: {
    game: {
      type: Object,
      required: true,
    },
    layoutMode: {
      type: String,
      default: 'desktop',
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    collapsed: {
      type: Boolean,
      default: false,
    },
    unreadCount: {
      type: Number,
      default: 0,
    },
    autoHideSeconds: {
      type: Number,
      default: 0,
    },
  },
  emits: ['message-appended', 'toggle-pin', 'hover-state', 'countdown-complete'],
  data() {
    return {
      said: '',
      messages: [
        {
          type: 'normal',
          text: 'Welcome to Verdigris.',
          username: '',
          color: '#1D56F2',
          timestamp: Date.now(),
          displayText: 'Welcome to Verdigris.',
          colorStyle: '',
          displayTime: formatTime(Date.now()),
        },
      ],
      hasFocus: false,
      countdownRemaining: 0,
      countdownTimer: null,
    };
  },
  computed: {
    chatboxClasses() {
      return [
        `chatbox--${this.layoutMode}`,
        {
          'chatbox--pinned': this.pinned,
          'chatbox--collapsed': this.collapsed,
        },
      ];
    },
    showCountdown() {
      return !this.pinned && !this.collapsed && this.countdownRemaining > 0;
    },
    countdownLabel() {
      return `${this.countdownRemaining}s`;
    },
  },
  watch: {
    collapsed: {
      immediate: true,
      handler(value) {
        if (!value && !this.pinned && this.autoHideSeconds > 0) {
          this.startCountdown();
        } else {
          this.stopCountdown();
        }
      },
    },
    pinned(newValue) {
      if (newValue) {
        this.stopCountdown();
      } else if (!this.collapsed && this.autoHideSeconds > 0) {
        this.startCountdown();
      }
    },
  },
  created() {
    this.messageHandler = (data) => this.pipeline(data);
    bus.$on('player:say', this.messageHandler);
    bus.$on('item:examine', this.messageHandler);
    bus.$on('combat:log', this.messageHandler);
    bus.$on('game:send:message', this.messageHandler);
  },
  mounted() {
    this.scrollToBottom();
  },
  beforeUnmount() {
    bus.$off('player:say', this.messageHandler);
    bus.$off('item:examine', this.messageHandler);
    bus.$off('combat:log', this.messageHandler);
    bus.$off('game:send:message', this.messageHandler);
    this.stopCountdown();
  },
  methods: {
    pipeline(incoming) {
      const normalised = normaliseChatMessage(incoming);
      if (!normalised) {
        return;
      }
      const {
        text = '',
        type = 'normal',
        username = null,
        color = '#1D56F2',
      } = normalised;

      this.appendChat({ type, username, color, text });
    },
    appendChat({ type, username, color, text }) {
      if (!text) {
        return;
      }
      const timestamp = Date.now();
      const formatted = this.formatMessage(type, color, text);
      const message = {
        type,
        username,
        color,
        text,
        displayText: formatted.displayText,
        colorStyle: formatted.colorStyle,
        timestamp,
        displayTime: formatTime(timestamp),
      };

      this.messages = [...this.messages.slice(-199), message];
      this.$emit('message-appended', { ...message });
      this.$nextTick(() => this.scrollToBottom());
    },
    formatMessage(type, color, text) {
      const sanitisedColor = typeof color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(color)
        ? color
        : '';
      if (type === 'chat' && sanitisedColor) {
        return { displayText: text, colorStyle: `color:${sanitisedColor}` };
      }
      if (type === 'combat') {
        return { displayText: text, colorStyle: `color:${sanitisedColor || '#ffd166'};font-weight:600` };
      }
      return { displayText: text, colorStyle: '' };
    },
    sendMessage() {
      const payload = this.said && this.said.trim();
      if (!payload) {
        this.blurAndRefocusGame();
        return;
      }
      // Enforce the maxlength from the input element
      const sanitised = payload.slice(0, 120);
      const player = this.game && this.game.player;
      if (!player || !player.socket_id) {
        return;
      }
      Socket.emit('player:say', { said: sanitised, id: player.socket_id });
      this.clearInput();
      this.blurAndRefocusGame();
    },
    clearInput() {
      this.said = '';
    },
    blurAndRefocusGame() {
      if (this.$refs.input) {
        this.$refs.input.blur();
      }
      if (typeof window.focusOnGame === 'function') {
        window.focusOnGame();
      }
    },
    scrollToBottom() {
      this.$nextTick(() => {
        const container = this.$refs.messageList;
        if (!container) {
          return;
        }
        container.scrollTop = container.scrollHeight;
      });
    },
    focusInput() {
      if (this.$refs.input) {
        this.$refs.input.focus();
      }
    },
    handleFocus() {
      this.hasFocus = true;
      this.$emit('hover-state', true);
      this.stopCountdown();
    },
    handleBlur() {
      this.hasFocus = false;
      this.$emit('hover-state', false);
      if (!this.collapsed && !this.pinned && this.autoHideSeconds > 0) {
        this.startCountdown();
      }
    },
    startCountdown() {
      if (this.autoHideSeconds <= 0) {
        this.stopCountdown();
        return;
      }
      this.stopCountdown();
      this.countdownRemaining = this.autoHideSeconds;
      this.countdownTimer = setInterval(() => {
        if (this.countdownRemaining <= 1) {
          this.stopCountdown();
          this.$emit('countdown-complete');
          return;
        }
        this.countdownRemaining -= 1;
      }, 1000);
    },
    stopCountdown() {
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
      }
      this.countdownRemaining = 0;
    },
  },
};
</script>

<style lang="scss" scoped>
@use '@/assets/scss/abstracts/tokens' as *;
@use '@/assets/scss/abstracts/breakpoints' as *;

.chatbox {
  position: relative;
  display: flex;
  flex-direction: column;
  width: var(--chat-width);
  max-width: 100%;
  background: rgba(7, 8, 10, 0.72);
  border: 1px solid rgba(180, 145, 86, 0.22);
  border-radius: var(--radius-md);
  color: #f0e6d2;
  overflow: hidden;
  transition: transform 180ms ease-out, opacity 180ms ease-out;

  &--collapsed {
    pointer-events: none;
    opacity: 0.1;
  }

  &--pinned {
    box-shadow: var(--shadow-strong);
  }

  &--mobile {
    width: 100%;
  }
}

.chatbox__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-xs) var(--space-sm);
  background:
    linear-gradient(90deg, rgba(82, 18, 24, 0.24), rgba(10, 12, 15, 0.78));
  border-bottom: 1px solid rgba(180, 145, 86, 0.2);
}

.chatbox__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.chatbox__title {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0;
  text-transform: uppercase;
  color: #f2d391;
}

.chatbox__countdown {
  margin: 0;
  font-size: 0.75em;
  color: var(--color-text-secondary);
}

.chatbox__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
}

.chatbox__badge {
  min-width: 18px;
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: #12100e;
  font-size: 0.7em;
  text-align: center;
  font-weight: 700;
}

.chatbox__pin {
  appearance: none;
  border: 1px solid rgba(180, 145, 86, 0.32);
  background: rgba(0, 0, 0, 0.42);
  color: #f0e6d2;
  border-radius: var(--radius-sm);
  padding: 4px 10px;
  font-size: var(--font-size-sm);
  cursor: pointer;

  &:hover {
    border-color: var(--color-border-strong);
    background: rgba(0, 0, 0, 0.55);
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent-strong);
    outline-offset: 2px;
  }
}

.chatbox__messages {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: rgba(0, 0, 0, 0.18);
  overflow-y: auto;
  max-height: 320px;
  scroll-behavior: smooth;
}

.chatbox__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.chatbox__message {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--space-xs);
  font-size: 12px;
  color: #f0e6d2;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.72);
}

.chatbox__username {
  color: var(--color-accent-strong);
  font-weight: 600;
}

.chatbox__text {
  overflow-wrap: break-word;
}

.chatbox__text--chat {
  font-weight: 500;
}

.chatbox__time {
  font-size: 0.7em;
  color: rgba(231, 218, 190, 0.62);
}

.chatbox__form {
  display: flex;
  align-items: stretch;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md) var(--space-md);
}

.chatbox__input {
  flex: 1;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(180, 145, 86, 0.32);
  background: rgba(2, 3, 5, 0.78);
  color: #f0e6d2;
  padding: 6px 8px;
  font-family: 'ChatFont', 'GameFont', sans-serif;
  font-size: var(--font-size-sm);

  &:focus-visible {
    outline: none;
    border-color: var(--color-accent);
  }
}

.chatbox__submit {
  border-radius: var(--radius-sm);
  border: 1px solid rgba(180, 145, 86, 0.46);
  background: linear-gradient(180deg, #3b3d42 0%, #18191d 100%);
  color: #f0e6d2;
  padding: 6px 12px;
  font-family: 'GameFont', sans-serif;
  font-size: var(--font-size-sm);
  cursor: pointer;

  &:hover {
    background: linear-gradient(180deg, #444850 0%, #202228 100%);
  }

  &:active {
    border-top-color: var(--color-frame-dark);
    border-left-color: var(--color-frame-dark);
    border-bottom-color: var(--color-bevel-light);
    border-right-color: var(--color-bevel-light);
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
}

@include media('<=tablet') {
  .chatbox {
    width: min(420px, 96vw);
  }

  .chatbox__messages {
    max-height: 260px;
  }
}

@include media('<=mobile') {
  .chatbox {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    margin: auto;
    width: 100%;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: 0 -16px 32px rgba(0, 0, 0, 0.55);
    transform: translateY(0);
  }

  .chatbox--collapsed {
    transform: translateY(calc(100% - 60px));
    opacity: 1;
    pointer-events: auto;
  }

  .chatbox__messages {
    max-height: 45vh;
  }
}
</style>
