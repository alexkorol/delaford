// Resources event handler

import bus from '../../utilities/bus.js';
import { normaliseChatMessage } from '../../chat-message.js';

export default {
  /**
   * Golden Plaque action result
   */
  'game:send:message': (data) => {
    const message = normaliseChatMessage(data);
    if (!message || !message.text) {
      return;
    }

    bus.$emit('game:send:message', {
      type: message.type || 'normal',
      text: message.text,
      color: message.color,
    });
  },

  /**
   * Update skills
   */
  'resource:skills:update': (incoming, context) => {
    if (!context || !context.game || !context.game.player) {
      return;
    }

    const skills = incoming && incoming.data ? incoming.data.data : null;
    if (!skills || typeof skills !== 'object') {
      return;
    }

    context.game.player.skills = skills;
  },
};
