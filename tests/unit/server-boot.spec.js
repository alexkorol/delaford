/** @vitest-environment node */

import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

/**
 * Boots the real server entrypoint in a child process. Unit tests import
 * modules in a different order than server/index.js does, so they cannot
 * catch import-graph problems (e.g. circular-import TDZ crashes) that only
 * appear on a genuine boot.
 */
describe('server boot smoke test', () => {
  it('starts server/index.js and reaches the listen line', async () => {
    const child = spawn(process.execPath, ['server/index.js'], {
      cwd: projectRoot,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    let settled = false;

    const booted = new Promise((resolve, reject) => {
      const finish = (fn, value) => {
        if (!settled) {
          settled = true;
          fn(value);
        }
      };

      const timer = setTimeout(() => {
        finish(reject, new Error(`Server did not reach listen line in time. Output:\n${output}`));
      }, 25000);
      timer.unref();

      const inspect = (chunk) => {
        output += chunk.toString();
        if (output.includes('ENVIRONMENT:')) {
          clearTimeout(timer);
          finish(resolve);
        }
      };

      child.stdout.on('data', inspect);
      child.stderr.on('data', (chunk) => {
        output += chunk.toString();
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        finish(reject, error);
      });

      child.on('exit', (code) => {
        clearTimeout(timer);
        finish(reject, new Error(`Server exited with code ${code} before listening. Output:\n${output}`));
      });
    });

    try {
      await booted;
      expect(output).toContain('ENVIRONMENT:');
      expect(output).not.toContain('ReferenceError');
    } finally {
      child.kill();
    }
  }, 30000);
});
