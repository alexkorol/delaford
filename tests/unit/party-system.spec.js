/** @vitest-environment node */

import { describe, expect, it, beforeEach, vi } from 'vitest';

// Mock dependencies before importing
vi.mock('#server/core/world.js', () => {
  const players = [];
  const scenes = new Map();
  const defaultTown = {
    id: 'town-1',
    name: 'Town',
    type: 'town',
    map: { background: [], foreground: [] },
    npcs: [],
    monsters: [],
    items: [],
    metadata: {},
  };

  scenes.set('town-1', defaultTown);

  return {
    default: {
      players,
      defaultTownId: 'town-1',
      scenes,
      getScene: (id) => scenes.get(id) || null,
      getDefaultTown: () => defaultTown,
      createInstance: (partyId, data) => {
        const scene = {
          id: `instance-${partyId}`,
          type: 'instance',
          map: data.map || { background: [], foreground: [] },
          npcs: data.npcs || [],
          monsters: data.monsters || [],
          items: data.items || [],
          metadata: data.metadata || {},
        };
        scenes.set(scene.id, scene);
        return scene;
      },
      getInstance: (partyId) => scenes.get(`instance-${partyId}`) || null,
      destroyInstance: (partyId) => {
        scenes.delete(`instance-${partyId}`);
      },
      assignPlayerToScene: (player, sceneId) => {
        player.sceneId = sceneId;
      },
      getSceneForPlayer: (player) => scenes.get(player.sceneId) || defaultTown,
      getScenePlayers: (sceneId) => players.filter(p => p.sceneId === sceneId),
    },
  };
});

vi.mock('#server/socket.js', () => ({
  default: {
    emit: vi.fn(),
    broadcast: vi.fn(),
  },
}));

vi.mock('#server/core/map.js', () => ({
  default: {
    generateInstance: vi.fn().mockResolvedValue({
      map: { background: [], foreground: [] },
      npcs: [],
      monsters: [],
      items: [],
      respawns: { items: [], monsters: [], resources: [] },
      metadata: { seed: 12345, spawnPoints: [{ x: 5, y: 5 }], rewards: {} },
    }),
  },
}));

vi.mock('#server/core/monster.js', () => ({
  default: class MockMonster {
    constructor(def) {
      this.id = def.id || 'mock-monster';
      this.uuid = 'mock-uuid';
      this.isAlive = true;
      this.toJSON = () => ({ id: this.id, uuid: this.uuid });
    }
  },
}));

vi.mock('#shared/ui.js', () => ({
  default: { getLevel: () => 1, randomElementFromArray: (arr) => arr[0] || {} },
}));

vi.mock('#shared/stats/index.js', () => ({
  syncShortcuts: vi.fn(),
  toClientPayload: (s) => s,
}));

const { PartyService } = await import('#server/player/handlers/party.js').then(mod => ({
  PartyService: mod.partyService.constructor,
}));

const makePlayer = (overrides = {}) => ({
  uuid: `player-${Math.random().toString(36).slice(2, 8)}`,
  username: `Player${Math.floor(Math.random() * 1000)}`,
  socket_id: `ws-${Math.random().toString(36).slice(2, 8)}`,
  sceneId: 'town-1',
  x: 7,
  y: 5,
  path: { grid: null },
  ...overrides,
});

describe('PartyService', () => {
  let service;
  let leader;
  let member;

  beforeEach(() => {
    service = new PartyService();
    leader = makePlayer({ username: 'Leader' });
    member = makePlayer({ username: 'Member' });
  });

  it('creates a party with leader as first member', () => {
    const party = service.createParty(leader);
    expect(party).not.toBeNull();
    expect(party.leaderId).toBe(leader.uuid);
    expect(party.members.has(leader.uuid)).toBe(true);
    expect(party.state).toBe('lobby');
  });

  it('returns null when creating a party without leader', () => {
    expect(service.createParty(null)).toBeNull();
  });

  it('tracks player → party mapping', () => {
    const party = service.createParty(leader);
    const found = service.getPartyForPlayer(leader.uuid);
    expect(found).toBe(party);
  });

  it('adds and removes members', () => {
    const party = service.createParty(leader);
    service.addMember(party, member);
    expect(party.members.size).toBe(2);

    service.removePlayer(member.uuid);
    expect(party.members.size).toBe(1);
    expect(service.getPartyForPlayer(member.uuid)).toBeNull();
  });

  it('transfers leadership when leader leaves', () => {
    const party = service.createParty(leader);
    service.addMember(party, member);

    service.removePlayer(leader.uuid);
    expect(party.leaderId).toBe(member.uuid);
    expect(party.members.size).toBe(1);
  });

  it('dissolves party when last member leaves', () => {
    const party = service.createParty(leader);
    const partyId = party.id;

    const result = service.removePlayer(leader.uuid);
    expect(result).toBeNull();
    expect(service.getParty(partyId)).toBeNull();
  });

  it('handles invite flow: invite → accept → member joined', () => {
    const party = service.createParty(leader);
    service.invitePlayer(party, leader, member);

    expect(party.invites.has(member.uuid)).toBe(true);

    const accepted = service.acceptInvite(party, member);
    expect(accepted).toBe(true);
    expect(party.members.has(member.uuid)).toBe(true);
    expect(party.invites.has(member.uuid)).toBe(false);
  });

  it('rejects expired invites', () => {
    const party = service.createParty(leader);
    service.invitePlayer(party, leader, member);

    // Expire the invite
    const invite = party.invites.get(member.uuid);
    invite.expiresAt = Date.now() - 1000;

    const accepted = service.acceptInvite(party, member);
    expect(accepted).toBe(false);
    expect(party.members.has(member.uuid)).toBe(false);
  });

  it('toggles ready state for members', () => {
    const party = service.createParty(leader);
    service.addMember(party, member);

    service.toggleReady(party, leader.uuid);
    expect(party.ready.has(leader.uuid)).toBe(true);

    service.toggleReady(party, member.uuid);
    expect(service.areAllReady(party)).toBe(true);

    service.toggleReady(party, leader.uuid); // toggle off
    expect(service.areAllReady(party)).toBe(false);
  });

  it('clearReadyState resets all members', () => {
    const party = service.createParty(leader);
    service.addMember(party, member);
    service.toggleReady(party, leader.uuid);
    service.toggleReady(party, member.uuid);
    expect(service.areAllReady(party)).toBe(true);

    service.clearReadyState(party);
    expect(party.ready.size).toBe(0);
    expect(service.areAllReady(party)).toBe(false);
  });

  it('getPartySnapshot produces serialisable output', () => {
    const party = service.createParty(leader);
    const snapshot = service.getPartySnapshot(party);

    expect(snapshot.id).toBe(party.id);
    expect(snapshot.leaderId).toBe(leader.uuid);
    expect(Array.isArray(snapshot.members)).toBe(true);
    expect(snapshot.members[0].uuid).toBe(leader.uuid);
    expect(snapshot.state).toBe('lobby');
  });
});
