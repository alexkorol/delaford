/**
 * Headless player harness — plays Verdigris over the real WebSocket protocol,
 * exactly like the browser client, so playtests exercise the full live server
 * (dispatch, handlers, world state, the 10Hz game loop) without a browser.
 *
 * Designed for LLM coding agents: high-level verbs, one authoritative
 * state() snapshot, and waitFor() for anything asynchronous.
 *
 *   const p = await HeadlessPlayer.connect();
 *   await p.enterZone('crypt', 'gauntlet');
 *   const s = await p.state();               // position, hp, monsters, items…
 *   await p.attack(s.monsters[0]);
 *   await p.waitFor(async () => (await p.state()).monsters.length < s.monsters.length);
 *   p.close();
 *
 * NOTE the boundary: this drives the SERVER truth through the real protocol.
 * Client-side rendering/binding bugs (Vue templates, canvas, focus) still
 * need a browser pass — see playtest/README.md.
 */

import WebSocket from 'ws';

const DEFAULT_URL = process.env.PLAYTEST_WS_URL || 'ws://localhost:6500';
const DEFAULT_TIMEOUT_MS = 8000;

const sleep = ms => new Promise(resolve => { setTimeout(resolve, ms); });

export class HeadlessPlayer {
  constructor(ws) {
    this.ws = ws;
    this.player = null; // login block player
    this.scene = null; // latest scene payload (login or transition)
    this.messages = []; // game:send:message texts
    this.hits = []; // combat:hit payloads
    this.inventory = [];
    this.stats = null; // latest player:stats:update for us
    this.lastMovement = null;
    this.events = []; // raw event log (ring buffer)
    this.pendingState = new Map(); // requestId -> resolver
    this.stateCounter = 0;
    this.loginCount = 0;
    this.chroniclesReadyCount = 0;
    this.chroniclesReady = null;
    this.chroniclesUpdateCount = 0;
    this.chroniclesUpdate = null;

    ws.on('message', (raw) => this.handleMessage(raw));
    ws.on('close', () => { this.closed = true; });
  }

  static async connect({
    url = DEFAULT_URL,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    loginPayload = { useGuestAccount: true },
  } = {}) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`WS connect timeout: ${url}`)), timeoutMs);
      ws.once('open', () => { clearTimeout(timer); resolve(); });
      ws.once('error', (error) => { clearTimeout(timer); reject(error); });
    });

    const player = new HeadlessPlayer(ws);
    player.emit('player:login', loginPayload);
    if (loginPayload.awaitChronicles && !loginPayload.scionName) {
      await player.waitFor(() => player.chroniclesReadyCount > 0, {
        label: 'Chronicles admission',
        timeoutMs,
      });
    } else {
      await player.waitFor(() => player.player !== null, { label: 'login', timeoutMs });
    }
    return player;
  }

  handleMessage(raw) {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch (error) {
      return;
    }

    const { event, data } = message;
    this.events.push({ event, at: Date.now() });
    if (this.events.length > 500) {
      this.events.splice(0, this.events.length - 500);
    }

    switch (event) {
      case 'player:login':
        this.loginCount += 1;
        this.player = data.player;
        this.scene = data.scene || null;
        this.inventory = (data.player && data.player.inventory && data.player.inventory.slots) || [];
        break;
      case 'player:chronicles:ready':
        this.chroniclesReadyCount += 1;
        this.chroniclesReady = data;
        break;
      case 'player:chronicles:update':
        this.chroniclesUpdateCount += 1;
        this.chroniclesUpdate = data;
        break;
      case 'world:scene:transition':
      case 'party:scene:transition':
        this.sceneTransitions = (this.sceneTransitions || 0) + 1;
        this.scene = data.scene || this.scene;
        if (data.playerState && this.player) {
          this.player.x = data.playerState.x;
          this.player.y = data.playerState.y;
          this.player.sceneId = data.playerState.sceneId;
        }
        break;
      case 'player:movement':
        if (this.player && data && data.uuid === this.player.uuid) {
          this.player.x = data.x;
          this.player.y = data.y;
          this.lastMovement = message.meta ? message.meta.movementStep : data.movementStep;
        }
        break;
      case 'player:stats:update':
        if (this.player && data && data.playerId === this.player.uuid) {
          this.stats = data;
        }
        break;
      case 'game:send:message':
        this.messages.push(typeof data === 'string' ? data : (data.text || ''));
        break;
      case 'combat:hit':
        this.hits.push(data);
        break;
      case 'core:refresh:inventory':
        this.inventory = data.data || data || [];
        break;
      case 'player:session-replaced':
        this.sessionReplaced = true;
        break;
      case 'party:error':
        this.partyErrors = this.partyErrors || [];
        this.partyErrors.push(data && data.error && data.error.message ? data.error.message : '');
        break;
      case 'dev:state': {
        const resolver = this.pendingState.get(data.requestId);
        if (resolver) {
          this.pendingState.delete(data.requestId);
          resolver(data.state);
        }
        break;
      }
      default:
        break;
    }
  }

  emit(event, data) {
    this.ws.send(JSON.stringify({ event, data }));
  }

  /** Authoritative server-side snapshot: position, hp, monsters, items, tree… */
  state({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this.stateCounter += 1;
    const requestId = `state-${this.stateCounter}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingState.delete(requestId);
        reject(new Error('dev:state timed out — is the server running with NODE_ENV!==production?'));
      }, timeoutMs);
      this.pendingState.set(requestId, (value) => {
        clearTimeout(timer);
        resolve(value);
      });
      this.emit('dev:state', { requestId });
    });
  }

  /** Wait until predicate() (sync or async) is truthy. */
  async waitFor(predicate, { timeoutMs = DEFAULT_TIMEOUT_MS, intervalMs = 150, label = 'condition' } = {}) {
    const deadline = Date.now() + timeoutMs;
     
    while (Date.now() < deadline) {
      const result = await predicate();
      if (result) {
        return result;
      }
      await sleep(intervalMs);
    }
     
    throw new Error(`Timed out waiting for ${label} (${timeoutMs}ms)`);
  }

  // ── Player verbs ──────────────────────────────────────────────────────

  /** Take one movement step ('up'/'down'/'left'/'right'/diagonals). */
  step(direction) {
    this.emit('player:move', { id: this.player.uuid, direction });
  }

  /** Walk N steps in a direction, pacing like a held key. */
  async move(direction, steps = 1, { stepMs = 180 } = {}) {
     
    for (let i = 0; i < steps; i += 1) {
      this.step(direction);
      await sleep(stepMs);
    }
     
  }

  /** Fire a skill ('primary-attack', 'dash', 'ability-1'…). */
  useSkill(skillId, direction = 'down') {
    this.emit('player:skill:trigger', {
      id: this.player.uuid,
      skillId,
      direction,
      issuedAt: Date.now(),
      modifiers: {},
      phase: 'start',
    });
  }

  /** Attack toward a target's tile (steps into melee arc direction). */
  async attack(target) {
    const s = await this.state();
    const dx = Math.sign((target.x || 0) - s.x);
    const dy = Math.sign((target.y || 0) - s.y);
    const direction = dy < 0 ? (dx < 0 ? 'up-left' : dx > 0 ? 'up-right' : 'up')
      : dy > 0 ? (dx < 0 ? 'down-left' : dx > 0 ? 'down-right' : 'down')
        : (dx < 0 ? 'left' : 'right');
    this.useSkill('primary-attack', direction);
    return direction;
  }

  /** Enter a solo Adventure zone (template + optional layout). */
  async enterZone(template, layout = null, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    // The server throttles instance starts per player (anti-spam). If we hit
    // the cooldown, wait it out and retry instead of failing the scenario.
    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      // Instance -> instance keeps the same scene id (same party), so wait on
      // the transition event, not on the id changing.
      const transitionsBefore = this.sceneTransitions || 0;
      const errorsBefore = (this.partyErrors || []).length;
      this.emit('instance:enterSolo', { template, layout });
      await this.waitFor(() => (
        (this.sceneTransitions || 0) > transitionsBefore
        || (this.partyErrors || []).length > errorsBefore
      ), {
        timeoutMs,
        label: `zone transition to ${template}`,
      });

      if ((this.sceneTransitions || 0) > transitionsBefore) {
        return this.scene;
      }

      const latestError = (this.partyErrors || [])[errorsBefore] || '';
      if (/not yet open/i.test(latestError) && attempt < maxAttempts) {
        await sleep(3200); // ride out the server's instance-start cooldown
        continue;
      }

      throw new Error(`enterZone(${template}/${layout}) rejected: ${latestError || 'unknown error'}`);
    }

    return this.scene;
  }

  /**
   * Right-click a world tile: asks the server to build the real context menu
   * and resolves with its entries (label + everything needed to choose one).
   */
  async rightClick(worldX, worldY, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    const menuPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('context menu build timed out')), timeoutMs);
      const onMessage = (raw) => {
        try {
          const message = JSON.parse(raw.toString());
          if (message.event === 'game:context-menu:items') {
            clearTimeout(timer);
            this.ws.off('message', onMessage);
            resolve(message.data.data || []);
          }
        } catch (error) { /* ignore */ }
      };
      this.ws.on('message', onMessage);
    });

    // Server derives world coordinates from tile.world when provided.
    this.emit('player:context-menu:build', {
      miscData: { clickedOn: { 0: 'main-canvas', 1: 'gameMap' } },
      tile: {
        x: 0, y: 0, world: { x: worldX, y: worldY },
      },
      player: { socket_id: this.player.socket_id },
    });

    return menuPromise;
  }

  /** Choose a context-menu entry (as returned by rightClick). */
  choose(menuItem, tile = {}) {
    this.emit('player:context-menu:action', {
      data: {
        item: menuItem,
        tile,
      },
      queueItem: {
        item: { uuid: menuItem.uuid, id: menuItem.id },
        tile,
        action: menuItem.action,
        at: menuItem.at || false,
        coordinates: menuItem.coordinates || false,
        queueable: menuItem.action && menuItem.action.queueable,
        world: tile.world,
      },
      player: { socket_id: this.player.socket_id },
    });
  }

  /** Right-click a ground item and Take it, waiting until it leaves the floor. */
  async takeItem(groundItem, { timeoutMs = 15000 } = {}) {
    const menu = await this.rightClick(groundItem.x, groundItem.y);
    const plain = entry => String(entry.label || '').replace(/<[^>]+>/g, '').trim().toLowerCase();
    const isTake = entry => plain(entry).startsWith('take')
      || (entry.action && String(entry.action.name || '').toLowerCase() === 'take');
    // More than one stack can occupy the same tile after an area attack. The
    // menu sorts newest-first, while state() preserves scene insertion order;
    // choosing the first generic Take entry can therefore pick up a different
    // stack and leave the requested UUID on the floor until timeout.
    const take = menu.find(entry => isTake(entry) && entry.uuid === groundItem.uuid)
      || menu.find(isTake);
    if (!take) {
      throw new Error(`No Take entry at ${groundItem.x},${groundItem.y}: ${menu.map(m => m.label).join(' | ')}`);
    }
    this.choose(take, { x: 0, y: 0, world: { x: groundItem.x, y: groundItem.y } });
    await this.waitFor(async () => {
      const s = await this.state();
      return !s.groundItems.some(item => item.uuid === groundItem.uuid);
    }, { timeoutMs, label: `pickup of ${groundItem.id}` });
  }

  /** Persist a skill-tree snapshot (as the pane does). */
  saveSkillTree(snapshot) {
    this.emit('player:skilltree:save', { snapshot });
  }

  /** Grab the item under/beside your feet (the 'z'/'g' key). */
  pickupUnderfoot() {
    this.emit('player:take:underfoot', {});
  }

  /** Select a Chronicles Scion and wait for world admission. */
  async selectScion(identity, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    const before = this.loginCount;
    const scion = typeof identity === 'string' ? { scionName: identity } : identity;
    this.emit('player:chronicles:select', scion);
    await this.waitFor(() => this.loginCount > before, {
      label: `Scion admission (${scion && scion.scionName})`,
      timeoutMs,
    });
    return this.player;
  }

  /** Save a complete Chronicles record and wait for the canonical revision. */
  async saveChronicles(state, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    const before = this.chroniclesUpdateCount;
    this.emit('player:chronicles:save', { state });
    await this.waitFor(() => this.chroniclesUpdateCount > before, {
      label: 'Chronicles persistence',
      timeoutMs,
    });
    return this.chroniclesUpdate;
  }

  /** Move a final-dead mortal Scion back to the authenticated Chronicles. */
  async returnToChronicles(identity, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    const before = this.chroniclesReadyCount;
    this.emit('player:chronicles:return', identity);
    await this.waitFor(() => this.chroniclesReadyCount > before, {
      label: 'return to Chronicles',
      timeoutMs,
    });
    return this.chroniclesReady;
  }

  // ── Wiz/dev commands ─────────────────────────────────────────────────

  devTeleport(x, y, sceneId = undefined) {
    this.emit('dev:teleport', { x, y, sceneId });
  }

  devGive(itemId, qty = 1) {
    this.emit('dev:give', { itemId, qty });
  }

  equipItem(item, targetSlot) {
    this.emit('item:equip', {
      item: {
        id: item.id,
        uuid: item.uuid,
        targetSlot,
        miscData: {
          slot: item.slot,
          targetSlot,
        },
      },
    });
  }

  devSetLevel(level) {
    this.emit('dev:setlevel', { level });
  }

  devHeal() {
    this.emit('dev:heal', {});
  }

  devKill({ allowCheatDeath = false } = {}) {
    this.emit('dev:kill', { allowCheatDeath });
  }

  close() {
    try {
      this.ws.close();
    } catch (error) { /* ignore */ }
  }
}

export default HeadlessPlayer;
