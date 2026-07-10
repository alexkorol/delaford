/**
 * Production deployment smoke test. It uses only public HTTP/WebSocket
 * behavior (no dev:* events), proving that TLS proxying and the quick guest
 * route reach a populated instance in under ten seconds.
 *
 *   npm run smoke:public -- https://play.example.com
 */

import WebSocket from 'ws';

const target = process.argv[2];
if (!target) {
  throw new Error('Usage: npm run smoke:public -- https://play.example.com');
}

const base = new URL(target);
const pageUrl = new URL('/?play', base);
const wsUrl = new URL('/', base);
wsUrl.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
const startedAt = Date.now();
const timeoutMs = 10000;

let response = null;
let fetchError = null;
while (Date.now() - startedAt < timeoutMs) {
  try {
    const candidate = await fetch(pageUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(2000),
    });
    if (candidate.ok) {
      response = candidate;
      break;
    }
    fetchError = new Error(`Public page returned HTTP ${candidate.status}.`);
  } catch (error) {
    fetchError = error;
  }
  await new Promise(resolve => { setTimeout(resolve, 250); });
}
if (!response) throw new Error(`Public page was unavailable within ${timeoutMs}ms: ${fetchError?.message || 'unknown error'}`);
const html = await response.text();
if (!html.includes('<div id="delaford">')) throw new Error('Public page did not return the Verdigris client.');

const result = await new Promise((resolve, reject) => {
  const socket = new WebSocket(wsUrl);
  const events = [];
  const remainingMs = Math.max(1, timeoutMs - (Date.now() - startedAt));
  const timer = setTimeout(() => {
    socket.close();
    reject(new Error(`Public quick-start exceeded ${timeoutMs}ms (events: ${events.join(', ') || 'none'}).`));
  }, remainingMs);

  const finish = (error, value) => {
    clearTimeout(timer);
    socket.close();
    if (error) reject(error); else resolve(value);
  };

  socket.on('open', () => {
    socket.send(JSON.stringify({
      event: 'player:login',
      data: {
        useGuestAccount: true,
        quickGuest: true,
        guestId: `public-smoke-${Date.now()}`,
      },
    }));
  });
  socket.on('error', error => finish(error));
  socket.on('message', (raw) => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }
    events.push(message.event || 'unknown');
    if (message.event === 'player:login') {
      socket.send(JSON.stringify({
        event: 'instance:enterSolo',
        data: { template: 'dungeon', layout: 'warren' },
      }));
      return;
    }
    if (!['world:scene:transition', 'party:scene:transition'].includes(message.event)) return;
    const scene = message.data?.scene;
    if (scene?.type !== 'instance' || !Array.isArray(scene.monsters) || !scene.monsters.length) {
      finish(new Error('Quick-start transition did not contain a populated instance.'));
      return;
    }
    finish(null, {
      url: pageUrl.href,
      scene: scene.name,
      monsters: scene.monsters.length,
      elapsedMs: Date.now() - startedAt,
    });
  });
});

if (result.elapsedMs >= timeoutMs) throw new Error(`Quick-start took ${result.elapsedMs}ms.`);
process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
