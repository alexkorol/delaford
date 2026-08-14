import actionEvents from './handlers/actions/index.js';
import socketEvents from './handlers/socket-events/index.js';
import partyEvents from './handlers/party.js';
import devEvents from './handlers/dev.js';
import chronicleEvents from './handlers/chronicles.js';
import worldWebEvents from './handlers/world-web.js';
import wagonEvents from './handlers/wagon.js';

/**
 * A global event handler (RPC)
 *
 * @param {object} data The incoming event and data associated
 * @param {object} ws The Socket connection to incoming client
 * @param {object} context The server context
 */
const Handler = {
  // Events like player login, say, queue action, etc.
  ...socketEvents,
  // Items from the context-menu.
  ...actionEvents,
  // Party lifecycle and instancing events
  ...partyEvents,
  // Wiz/dev playtest commands (no-ops in production)
  ...devEvents,
  // Authenticated account-level House and scion lifecycle events.
  ...chronicleEvents,
  // Wayfinder's Chart + world-web zone travel.
  ...worldWebEvents,
  // House wagon: outfitting, road purse, improvements.
  ...wagonEvents,
};

export default Handler;
