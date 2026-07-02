import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

import { normaliseChatMessage } from '@/core/chat-message.js';

const readSource = relativePath => readFileSync(
  fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
  'utf8',
);

describe('chat message normalisation', () => {
  it('keeps existing chat payloads unchanged', () => {
    const payload = { type: 'combat', text: 'You hit Wolf for 4.' };

    expect(normaliseChatMessage(payload)).toBe(payload);
  });

  it('unwraps socket event payloads recursively', () => {
    expect(normaliseChatMessage({
      data: {
        data: {
          type: 'normal',
          text: 'You have gained a level.',
        },
      },
    })).toEqual({
      type: 'normal',
      text: 'You have gained a level.',
    });
  });

  it('turns plain client bus messages into visible normal chat lines', () => {
    expect(normaliseChatMessage('Party is full.')).toEqual({
      type: 'normal',
      text: 'Party is full.',
    });
  });

  it('subscribes the chatbox to client-side game messages', () => {
    const source = readSource('src/components/Chatbox.vue');

    expect(source).toContain("bus.$on('game:send:message', this.messageHandler);");
    expect(source).toContain("bus.$off('game:send:message', this.messageHandler);");
    expect(source).toContain('normaliseChatMessage(incoming)');
  });
});
