/** Boot an isolated production server, run the public-only probe, and exit. */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const port = Number(process.env.PUBLIC_SMOKE_PORT) || 6520;
const stamp = `${process.pid}-${Date.now()}`;
const database = path.join(os.tmpdir(), `verdigris-public-smoke-${stamp}.sqlite`);
const origin = `http://localhost:${port}`;

const server = spawn(process.execPath, ['server/index.js'], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    CHRONICLES_DB_FILE: database,
    IDENTITY_DB_FILE: database,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverOutput = '';
server.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
server.stderr.on('data', chunk => { serverOutput += chunk.toString(); });

const waitForHttp = async () => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Production server exited early.\n${serverOutput}`);
    try {
      const response = await fetch(`${origin}/?play`);
      if (response.ok) return;
    } catch { /* still booting */ }
    await new Promise(resolve => { setTimeout(resolve, 200); });
  }
  throw new Error(`Production server did not become ready.\n${serverOutput}`);
};

const runProbe = () => new Promise((resolve, reject) => {
  const probe = spawn(process.execPath, ['playtest/public-smoke.mjs', origin], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  probe.stdout.on('data', chunk => { output += chunk.toString(); });
  probe.stderr.on('data', chunk => { output += chunk.toString(); });
  const timer = setTimeout(() => {
    probe.kill();
    reject(new Error(`Production smoke probe did not exit.\n${output}`));
  }, 15000);
  probe.on('exit', (code) => {
    clearTimeout(timer);
    if (code === 0) resolve(output.trim());
    else reject(new Error(`Production smoke probe failed (${code}).\n${output}`));
  });
});

try {
  await waitForHttp();
  process.stdout.write(`${await runProbe()}\n`);
} finally {
  server.kill();
  [database, `${database}-wal`, `${database}-shm`].forEach((file) => {
    try { fs.rmSync(file, { force: true }); } catch { /* already gone */ }
  });
}
