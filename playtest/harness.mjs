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
import {
  PLAYER_MOVE_DISTANCE,
  PLAYER_MOVE_SAMPLE_MS,
} from '#shared/movement.js';

const DEFAULT_URL = process.env.PLAYTEST_WS_URL || 'ws://localhost:6500';
const DEFAULT_TIMEOUT_MS = 8000;

const sleep = ms => new Promise(resolve => { setTimeout(resolve, ms); });

export class HeadlessPlayer {
  constructor(ws, options = {}) {
    this.ws = ws;
    this.player = null; // login block player
    this.scene = null; // latest scene payload (login or transition)
    this.messages = []; // game:send:message texts
    this.hits = []; // combat:hit payloads
    this.telegraphs = []; // monster:telegraph payloads
    this.inventory = [];
    this.stats = null; // latest player:stats:update for us
    this.lastMovement = null;
    this.events = []; // raw event log (ring buffer)
    this.scionFalls = [];
    this.party = null;
    this.partyInvites = [];
    this.screens = [];
    this.pendingState = new Map(); // requestId -> resolver
    this.stateCounter = 0;
    this.chronicle = null;
    this.houseName = options.houseName || 'Playtest House';
    this.scionName = options.scionName || 'Harness';

    ws.on('message', (raw) => this.handleMessage(raw));
    ws.on('close', () => { this.closed = true; });
  }

  static async connect({
    url = DEFAULT_URL,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    guestId = 'playtest-primary',
    houseName,
    scionName,
    quickGuest = false,
  } = {}) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`WS connect timeout: ${url}`)), timeoutMs);
      ws.once('open', () => { clearTimeout(timer); resolve(); });
      ws.once('error', (error) => { clearTimeout(timer); reject(error); });
    });

    const player = new HeadlessPlayer(ws, { houseName, scionName });
    player.emit('player:login', { useGuestAccount: true, guestId, quickGuest });
    await player.waitFor(() => player.player !== null, { label: 'login', timeoutMs });
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
        this.player = data.player;
        this.scene = data.scene || null;
        this.inventory = (data.player && data.player.inventory && data.player.inventory.slots) || [];
        if (data.quickStart === true) {
          // Mirrors the client: quick guests drop into the first stretch of
          // their House's Tin Road (tier 1 is always charted).
          this.emit('world:zone:enter', { nodeId: 'tin:1:0' });
        }
        break;
      case 'chronicles:state': {
        this.chronicle = data.chronicle || { houses: [] };
        const houses = this.chronicle.houses || [];
        const house = houses.find(entry => entry.id === this.chronicle.activeHouseId) || houses[0];
        if (!house) {
          this.emit('chronicles:house:found', { name: this.houseName });
        } else if (!(house.scions || []).length) {
          this.emit('chronicles:scion:create', { houseId: house.id, name: this.scionName });
        } else {
          this.emit('chronicles:scion:set-out', {
            scionId: data.createdScionId || house.scions[0].id,
          });
        }
        break;
      }
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
      case 'monster:telegraph':
        this.telegraphs.push(data);
        break;
      case 'core:refresh:inventory':
        this.inventory = data.data || data || [];
        break;
      case 'open:screen':
        this.screens.push({ screen: data.screen, payload: data.payload });
        break;
      case 'player:session-replaced':
        this.sessionReplaced = true;
        break;
      case 'chronicles:scion-fallen':
        this.scionFalls.push(data);
        this.chronicle = data.chronicle || this.chronicle;
        break;
      case 'chronicles:scion-witnessed':
        this.scionFalls.push(data);
        break;
      case 'party:update':
        this.party = data.party || null;
        break;
      case 'party:invited':
        if (data.invite) this.partyInvites.push(data.invite);
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
      // This read still uses a bounded development-rate bucket. Retry the
      // idempotent request below that bucket's refill rate instead of failing
      // the whole playtest on one dropped diagnostic frame.
      const request = () => this.emit('dev:state', { requestId });
      const retry = setInterval(request, 1000);
      const timer = setTimeout(() => {
        clearInterval(retry);
        this.pendingState.delete(requestId);
        reject(new Error('dev:state timed out — is the server running with NODE_ENV!==production?'));
      }, timeoutMs);
      this.pendingState.set(requestId, (value) => {
        clearInterval(retry);
        clearTimeout(timer);
        resolve(value);
      });
      request();
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

  /** Send one continuous movement sample ('up'/'down'/'left'/'right'/diagonals). */
  step(direction) {
    this.emit('player:move', { id: this.player.uuid, direction });
  }

  /** Move N tile-lengths in a direction, pacing samples like a held key. */
  async move(direction, steps = 1, { stepMs = PLAYER_MOVE_SAMPLE_MS } = {}) {
    const samples = Math.max(1, Math.ceil(steps / PLAYER_MOVE_DISTANCE));

    for (let i = 0; i < samples; i += 1) {
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
    // Instance -> instance keeps the same scene id (same party), so wait on
    // the transition event, not on the id changing.
    const transitionsBefore = this.sceneTransitions || 0;
    this.emit('instance:enterSolo', { template, layout });
    await this.waitFor(() => (this.sceneTransitions || 0) > transitionsBefore, {
      timeoutMs,
      label: `zone transition to ${template}`,
    });
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

  async inventoryMenu(item, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    const menuPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('inventory context menu build timed out')), timeoutMs);
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

    this.emit('player:context-menu:build', {
      miscData: {
        clickedOn: { 0: 'inventory-item', 1: 'inventorySlot' },
        slot: item.slot,
      },
      tile: { x: 0, y: 0 },
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
    const take = menu.find(entry => plain(entry).startsWith('take')
      || (entry.action && String(entry.action.name || '').toLowerCase() === 'take'));
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

  /** Equip an inventory item through the production socket handler. */
  equipItem(item) {
    this.emit('item:equip', {
      item: {
        id: item.id,
        uuid: item.uuid,
        slot: item.slot,
        miscData: { slot: item.slot },
      },
    });
  }

  /** Grab the item under/beside your feet (the 'z'/'g' key). */
  pickupUnderfoot() {
    this.emit('player:take:underfoot', {});
  }

  createParty() {
    this.emit('party:create', {});
  }

  invitePlayer(username) {
    this.emit('party:invite', { username });
  }

  acceptPartyInvite(partyId) {
    this.emit('party:invite:accept', { partyId });
  }

  togglePartyReady() {
    this.emit('party:ready', {});
  }

  startPartyInstance() {
    this.emit('party:startInstance', {});
  }

  // ── Wiz/dev commands ─────────────────────────────────────────────────

  devTeleport(x, y, sceneId = undefined) {
    this.emit('dev:teleport', { x, y, sceneId });
  }

  devGive(itemId, qty = 1, options = {}) {
    this.emit('dev:give', { itemId, qty, ...options });
  }

  devDrop(itemId, options = {}) {
    this.emit('dev:drop', { itemId, ...options });
  }

  devResetMonster(monsterUuid, options = {}) {
    this.emit('dev:monster:reset', { monsterUuid, ...options });
  }

  devClearFloor() {
    this.emit('dev:clear-floor', {});
  }

  devSetLevel(level) {
    this.emit('dev:setlevel', { level });
  }

  devHeal() {
    this.emit('dev:heal', {});
  }

  devHurt(amount = 5) {
    this.emit('dev:hurt', { amount });
  }

  devPrepareFinalDeath() {
    this.emit('dev:prepare-final-death', {});
  }

  devReleaseRelic() {
    this.emit('dev:release-relic', {});
  }

  close() {
    try {
      this.ws.close();
    } catch (error) { /* ignore */ }
  }
}

export default HeadlessPlayer;
