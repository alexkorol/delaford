import { createApp } from 'vue';
import { plugin as VueTippy } from 'vue-tippy';
import 'tippy.js/dist/tippy.css';

import Delaford from './Delaford.vue';
import Socket from './core/utilities/socket.js';
import { registerGlobalComponents } from './plugins/register-components.js';
import { installStores } from './stores/index.js';

const app = createApp(Delaford);

installStores(app);
registerGlobalComponents(app);

app.use(VueTippy, {
  animation: 'fade',
  inertia: true,
  size: 'small',
  theme: 'translucent',
  arrow: true,
  followCursor: true,
});

if (typeof window !== 'undefined' && 'WebSocket' in window) {
  // Production default: same host/port the page was served from, so a
  // self-hosted build works over LAN or Tailscale with no configuration.
  // Override with VITE_WS_URL at build time when fronted by a proxy.
  const sameOrigin = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
  const wsurl = {
    prod: import.meta.env.VITE_WS_URL || sameOrigin,
    dev: `ws://${window.location.hostname}:6500`,
  };

  const url = import.meta.env.PROD ? wsurl.prod : wsurl.dev;
  window.ws = new WebSocket(url);
  Socket.ensureListeners();
  Socket.flushQueue();
}

window.addEventListener('beforeunload', () => {
  if (window.ws) {
    window.ws.close();
  }
});

window.focusOnGame = () => {
  const canvas = document.querySelector('canvas#game-map.main-canvas');
  if (canvas) {
    canvas.focus();
  }
};

app.mount('#delaford');
