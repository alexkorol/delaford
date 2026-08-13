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

vi.mock('#server/core/entities/player/stats-manager.js', () => ({
  broadcastStats: vi.fn(),
  default: vi.fn(),
}));

vi.mock('#server/core/map.js', () => ({
  LAYOUT_IDS: ['warren', 'clearings', 'gauntlet'],
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
const { default: world } = await import('#server/core/world.js');

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
    // forEachMember resolves members through world.players, so the test
    // players must actually live in the world for member-level effects
    // (teleports, path cancellation) to be observable.
    world.players.length = 0;
    world.players.push(leader, member);
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

  it('startSoloInstance wraps a lone player in a party and enters an instance', async () => {
    await service.startSoloInstance(leader, { template: 'crypt' });

    const party = service.getPartyForPlayer(leader.uuid);
    expect(party).not.toBeNull();
    expect(party.members.size).toBe(1);
    expect(party.metadata.template).toBe('crypt');
    expect(party.state).toBe('instance');
    expect(party.sceneId).toContain('instance-');
  });

  it('publishes cleared readiness in the instance admission snapshot', async () => {
    const { default: Socket } = await import('#server/socket.js');
    const party = service.createParty(leader);
    service.addMember(party, member);
    service.toggleReady(party, leader.uuid);
    service.toggleReady(party, member.uuid);
    Socket.emit.mockClear();

    await service.startInstance(party, leader);

    const updates = Socket.emit.mock.calls
      .filter(([event]) => event === 'party:update')
      .map(([, payload]) => payload.party);
    expect(updates).not.toHaveLength(0);
    expect(updates.at(-1).members.every(entry => entry.ready === false)).toBe(true);
  });

  it('startSoloInstance falls back to the dungeon template for unknown zones', async () => {
    await service.startSoloInstance(leader, { template: 'not-a-zone' });
    const party = service.getPartyForPlayer(leader.uuid);
    expect(party.metadata.template).toBe('dungeon');
  });

  it('startSoloInstance threads the zone layout through to the generator', async () => {
    const { default: GameMap } = await import('#server/core/map.js');
    await service.startSoloInstance(leader, { template: 'crypt', layout: 'gauntlet' });

    const party = service.getPartyForPlayer(leader.uuid);
    expect(party.metadata.layout).toBe('gauntlet');
    expect(GameMap.generateInstance).toHaveBeenLastCalledWith(
      expect.objectContaining({ template: 'crypt', layout: 'gauntlet', depth: 1 }),
    );
  });

  it('startSoloInstance nulls an unknown layout so the generator picks the theme default', async () => {
    const { default: GameMap } = await import('#server/core/map.js');
    await service.startSoloInstance(leader, { template: 'crypt', layout: 'spiral-of-doom' });

    const party = service.getPartyForPlayer(leader.uuid);
    expect(party.metadata.layout).toBeNull();
    expect(GameMap.generateInstance).toHaveBeenLastCalledWith(
      expect.objectContaining({ template: 'crypt', layout: null }),
    );
  });

  // Found in live play: entering an instance while click-walking left the
  // stale surface path running; one leftover step carried the player from the
  // spawn tile onto the adjacent entry stairs and instantly bounced the party
  // back to town ("The party returns to the surface." right after entering).
  it('cancels any in-flight walk when teleporting members into an instance', async () => {
    leader.x = 40;
    leader.y = 90;
    leader.cancelPathfinding = vi.fn();

    await service.startSoloInstance(leader, { template: 'crypt' });

    expect(leader.cancelPathfinding).toHaveBeenCalled();
    expect(leader.x).toBe(5); // mock generator's spawn point
    expect(leader.y).toBe(5);
  });

  // Found in live play: returnToTown kept the dungeon coordinates, so leaving
  // an instance materialised the player at those raw x/y on the surface map —
  // in the middle of Fenmire Causeway, next to its boss.
  it('returns members to where they entered the instance from', async () => {
    leader.x = 40;
    leader.y = 90;
    leader.cancelPathfinding = vi.fn();

    await service.startSoloInstance(leader, { template: 'crypt' });
    const party = service.getPartyForPlayer(leader.uuid);
    expect(leader.preInstancePosition).toEqual({ x: 40, y: 90, sceneId: 'town-1' });

    // Descending to another floor must not overwrite the surface entry point.
    await service.enterFloor(party, 2);
    expect(leader.preInstancePosition).toEqual({ x: 40, y: 90, sceneId: 'town-1' });

    service.returnToTown(party);

    expect(leader.sceneId).toBe('town-1');
    expect(leader.x).toBe(40);
    expect(leader.y).toBe(90);
    expect(leader.preInstancePosition).toBeNull();
    expect(leader.cancelPathfinding).toHaveBeenCalled();
  });

  it('falls back to the town spawn when no entry position was recorded', async () => {
    await service.startSoloInstance(leader, { template: 'dungeon' });
    const party = service.getPartyForPlayer(leader.uuid);
    leader.preInstancePosition = null; // e.g. joined the party mid-instance

    service.returnToTown(party);

    expect(leader.sceneId).toBe('town-1');
    expect(leader.x).toBe(38);
    expect(leader.y).toBe(115);
  });

  it('startSoloInstance refuses when the player is in a multi-member party', async () => {
    const party = service.createParty(leader);
    service.addMember(party, member);

    await service.startSoloInstance(leader, { template: 'crypt' });

    expect(party.state).not.toBe('instance');
  });

  it('startSoloInstance re-enters when a stale solo party is stuck inside an instance', async () => {
    await service.startSoloInstance(leader, { template: 'dungeon' });
    const party = service.getPartyForPlayer(leader.uuid);
    expect(party.state).toBe('instance');

    // Simulate a reconnect leaving the party flagged inside; picking a new
    // zone must self-heal rather than error out.
    await service.startSoloInstance(leader, { template: 'marsh' });

    expect(party.metadata.template).toBe('marsh');
    expect(party.state).toBe('instance');
    expect(party.sceneId).toContain('instance-');
  });
});
