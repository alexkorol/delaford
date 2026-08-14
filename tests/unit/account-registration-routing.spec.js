import { describe, expect, it } from 'vitest';

import { permittedDevelopmentOrigin } from '../../server/core/http/development-cors.js';
import { accountEndpoint } from '../../src/lib/account-endpoint.js';

describe('account registration routing', () => {
  it('derives the account API from insecure and secure game sockets', () => {
    expect(accountEndpoint('ws://localhost:6500')).toBe('http://localhost:6500/api/accounts');
    expect(accountEndpoint('wss://play.example.test/socket')).toBe('https://play.example.test/api/accounts');
  });

  it('falls back to same-origin registration when the socket is unavailable or malformed', () => {
    expect(accountEndpoint()).toBe('/api/accounts');
    expect(accountEndpoint('not a URL')).toBe('/api/accounts');
  });

  it('permits only the same-host Vite development origin', () => {
    expect(permittedDevelopmentOrigin('http://localhost:5173', 'localhost'))
      .toBe('http://localhost:5173');
    expect(permittedDevelopmentOrigin('http://localhost:5173', '127.0.0.1'))
      .toBe('http://localhost:5173');
    expect(permittedDevelopmentOrigin('http://attacker.test:5173', 'localhost')).toBeNull();
    expect(permittedDevelopmentOrigin('http://localhost:5174', 'localhost')).toBeNull();
    expect(permittedDevelopmentOrigin('malformed', 'localhost')).toBeNull();
  });
});
