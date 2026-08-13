import playerEvents from './events/player.js';
import itemEvents from './events/item.js';
import resourceEvents from './events/resource.js';
import npcEvents from './events/npc.js';
import monsterEvents from './events/monster.js';
import worldEvents from './events/world.js';
import screenEvents from './events/screen.js';
import partyEvents from './events/party.js';
import questEvents from './events/quest.js';

/**
 * A global event handler [CLIENT SIDE] (RPC)
 *
 * @param {object} data The incoming event and data associated
 * @param {object} ws The Socket connection to incoming client
 * @param {object} context The server context
 */

// These are events that come from the server that
// will manipulate and change the client accordingly.
const handler = {
  ...playerEvents,
  ...itemEvents,
  ...resourceEvents,
  ...npcEvents,
  ...monsterEvents,
  ...worldEvents,
  ...screenEvents,
  ...partyEvents,
  ...questEvents,

  /**
   * Receive the data from the client upon browser open
   */
  'server:send:items': (data) => {
    window.allItems = data.data.items;
  },
};

export default handler;
