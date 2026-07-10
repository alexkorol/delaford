/**
 * Deployment preflight: boot isolated production, expose it through a
 * temporary Cloudflare TLS tunnel, run the public-only HTTP/WSS probe, then
 * terminate both children. Requires cloudflared on PATH; it does not create
 * or retain a tunnel/account.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const port = Number(process.env.PUBLIC_SMOKE_PORT) || 6520;
const stamp = `${process.pid}-${Date.now()}`;
const database = path.join(os.tmpdir(), `verdigris-tunnel-smoke-${stamp}.sqlite`);
const origin = `http://localhost:${port}`;

const spawnOptions = { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] };
const server = spawn(process.execPath, ['server/index.js'], {
  ...spawnOptions,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    CHRONICLES_DB_FILE: database,
    IDENTITY_DB_FILE: database,
  },
});
let serverOutput = '';
server.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
server.stderr.on('data', chunk => { serverOutput += chunk.toString(); });

const waitForHttp = async () => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Production server exited early.\n${serverOutput}`);
    try {
      if ((await fetch(`${origin}/?play`)).ok) return;
    } catch { /* still booting */ }
    await new Promise(resolve => { setTimeout(resolve, 200); });
  }
  throw new Error(`Production server did not become ready.\n${serverOutput}`);
};

const runProbe = url => new Promise((resolve, reject) => {
  const probe = spawn(process.execPath, ['playtest/public-smoke.mjs', url], spawnOptions);
  let output = '';
  probe.stdout.on('data', chunk => { output += chunk.toString(); });
  probe.stderr.on('data', chunk => { output += chunk.toString(); });
  const timer = setTimeout(() => {
    probe.kill();
    reject(new Error(`Public tunnel probe did not exit.\n${output}`));
  }, 20000);
  probe.on('exit', (code) => {
    clearTimeout(timer);
    if (code === 0) resolve(output.trim());
    else reject(new Error(`Public tunnel probe failed (${code}).\n${output}`));
  });
});

// A newly issued trycloudflare hostname may take a few seconds to appear in
// recursive DNS. That provisioning delay happens before a URL is shared and
// is not part of the player's ten-second page-to-combat budget.
const waitForPublicHostname = async (url) => {
  const deadline = Date.now() + 30000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/?play`, { signal: AbortSignal.timeout(2500) });
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => { setTimeout(resolve, 500); });
  }
  throw new Error(`Public tunnel hostname did not become ready: ${lastError?.message || 'unknown error'}`);
};

let tunnel = null;
try {
  await waitForHttp();
  tunnel = spawn('cloudflared', ['tunnel', '--url', origin, '--no-autoupdate'], spawnOptions);
  let tunnelOutput = '';
  const publicUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Tunnel URL timed out.\n${tunnelOutput}`)), 30000);
    const inspect = (chunk) => {
      tunnelOutput += chunk.toString();
      const match = tunnelOutput.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    };
    tunnel.stdout.on('data', inspect);
    tunnel.stderr.on('data', inspect);
    tunnel.on('error', (error) => { clearTimeout(timer); reject(error); });
    tunnel.on('exit', (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timer);
        reject(new Error(`cloudflared exited ${code}.\n${tunnelOutput}`));
      }
    });
  });
  await waitForPublicHostname(publicUrl);
  process.stdout.write(`${await runProbe(publicUrl)}\n`);
} finally {
  if (tunnel) tunnel.kill();
  server.kill();
  [database, `${database}-wal`, `${database}-shm`].forEach((file) => {
    try { fs.rmSync(file, { force: true }); } catch { /* already gone */ }
  });
}
