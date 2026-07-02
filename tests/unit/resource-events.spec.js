import { afterEach, describe, expect, it, vi } from 'vitest';

import resourceEvents from '@/core/player/events/resource.js';
import bus from '@/core/utilities/bus.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resource event handlers', () => {
  it('ignores skill updates before a player is active', () => {
    expect(() => {
      resourceEvents['resource:skills:update']({
        data: { data: { attack: { level: 2, exp: 100 } } },
      }, {
        game: {},
      });
    }).not.toThrow();
  });

  it('applies skill updates to the active player', () => {
    const skills = { attack: { level: 2, exp: 100 } };
    const context = {
      game: {
        player: { skills: {} },
      },
    };

    resourceEvents['resource:skills:update']({
      data: { data: skills },
    }, context);

    expect(context.game.player.skills).toBe(skills);
  });

  it('normalises server messages into visible chat events', () => {
    const emitSpy = vi.spyOn(bus, '$emit');

    resourceEvents['game:send:message']({
      data: {
        data: {
          type: 'normal',
          text: 'You have gained an Attack level!',
        },
      },
    });

    expect(emitSpy).toHaveBeenCalledWith('game:send:message', {
      type: 'normal',
      text: 'You have gained an Attack level!',
      color: undefined,
    });
  });

  it('supports plain string message payloads without throwing', () => {
    const emitSpy = vi.spyOn(bus, '$emit');

    expect(() => resourceEvents['game:send:message']('Party is full.')).not.toThrow();
    expect(emitSpy).toHaveBeenCalledWith('game:send:message', {
      type: 'normal',
      text: 'Party is full.',
      color: undefined,
    });
  });

  it('ignores malformed message payloads without throwing', () => {
    const emitSpy = vi.spyOn(bus, '$emit');

    expect(() => resourceEvents['game:send:message']({ data: {} })).not.toThrow();
    expect(emitSpy).not.toHaveBeenCalled();
  });
});
