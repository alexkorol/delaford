/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#server/core/world.js', () => ({
  default: {
    players: [],
    scenes: new Map(),
    defaultTownId: 'town-1',
    getScene: () => null,
    getScenePlayers: () => [],
    map: { background: [], foreground: [] },
  },
}));

vi.mock('#server/socket.js', () => ({
  default: {
    emit: vi.fn(),
    broadcast: vi.fn(),
    sendMessageToPlayer: vi.fn(),
  },
}));

vi.mock('#server/core/entities/player/stats-manager.js', () => ({
  broadcastStats: vi.fn(),
  default: vi.fn(),
}));

const {
  processResourceRegeneration,
  HEALTH_REGEN_COMBAT_DELAY_MS,
} = await import('#server/core/combat/regeneration.js');
const { default: world } = await import('#server/core/world.js');
const { broadcastStats } = await import('#server/core/entities/player/stats-manager.js');

const makePlayer = (overrides = {}) => ({
  uuid: `player-${Math.random().toString(36).slice(2, 8)}`,
  socket_id: 'socket-1',
  sceneId: 'town-1',
  combat: {},
  stats: {
    resources: {
      health: { current: 50, max: 100 },
      mana: { current: 20, max: 100 },
    },
    lifecycle: { state: 'alive' },
  },
  ...overrides,
});

describe('resource regeneration', () => {
  beforeEach(() => {
    world.players = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('regenerates mana every tick and caps at max', () => {
    const player = makePlayer();
    player.stats.resources.mana.current = 98;
    world.players = [player];

    processResourceRegeneration(10_000);
    expect(player.stats.resources.mana.current).toBe(100);

    processResourceRegeneration(12_000);
    expect(player.stats.resources.mana.current).toBe(100);
  });

  it('regenerates health only after the out-of-combat delay', () => {
    const player = makePlayer();
    player.combat.lastCombatAt = 10_000;
    world.players = [player];

    processResourceRegeneration(10_000 + HEALTH_REGEN_COMBAT_DELAY_MS - 1);
    expect(player.stats.resources.health.current).toBe(50);

    processResourceRegeneration(10_000 + HEALTH_REGEN_COMBAT_DELAY_MS);
    expect(player.stats.resources.health.current).toBeGreaterThan(50);
  });

  it('does not regenerate dead or awaiting-respawn players', () => {
    const dead = makePlayer();
    dead.stats.resources.health.current = 0;
    const awaiting = makePlayer();
    awaiting.stats.lifecycle.state = 'awaiting-respawn';
    world.players = [dead, awaiting];

    const summary = processResourceRegeneration(50_000);

    expect(summary.updated).toBe(0);
    expect(dead.stats.resources.health.current).toBe(0);
    expect(dead.stats.resources.mana.current).toBe(20);
    expect(awaiting.stats.resources.mana.current).toBe(20);
  });

  it('broadcasts stats only for players whose resources changed', () => {
    const full = makePlayer();
    full.stats.resources.health.current = 100;
    full.stats.resources.mana.current = 100;
    const hurt = makePlayer();
    world.players = [full, hurt];

    const summary = processResourceRegeneration(50_000);

    expect(summary.updated).toBe(1);
    expect(broadcastStats).toHaveBeenCalledTimes(1);
    expect(broadcastStats).toHaveBeenCalledWith(hurt);
  });

  it('keeps the hp/mana shortcuts in sync after regeneration', () => {
    const player = makePlayer();
    world.players = [player];

    processResourceRegeneration(50_000);

    expect(player.hp).toBe(player.stats.resources.health);
    expect(player.mana).toBe(player.stats.resources.mana);
  });
});
