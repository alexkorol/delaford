/**
 * Playtest runner: boots a real dev server, plays through every core-loop
 * scenario with the headless player, reports PASS/FAIL.
 *
 *   npm run playtest                 # boot a server on :6510 and run all
 *   npm run playtest -- combat loot  # run a subset
 *   PLAYTEST_WS_URL=ws://localhost:6500 npm run playtest -- --attach
 *                                    # reuse an already-running dev server
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

import HeadlessPlayer from './harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const scenariosDir = path.join(here, 'scenarios');

const PORT = Number(process.env.PLAYTEST_PORT) || 6510;
const args = process.argv.slice(2);
const attach = args.includes('--attach');
const requested = args.filter(arg => !arg.startsWith('--'));

const url = attach
  ? (process.env.PLAYTEST_WS_URL || 'ws://localhost:6500')
  : `ws://localhost:${PORT}`;

const log = (line) => process.stdout.write(`${line}\n`);

const startServer = () => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(PORT),
      PLAYER_SAVE_COOLDOWN_MS: '999999999',
      // Hermetic saves: never inherit or clobber the developer's character.
      GUEST_SAVE_DIR: path.join(os.tmpdir(), `verdigris-playtest-${Date.now()}`),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  const timer = setTimeout(() => {
    child.kill();
    reject(new Error(`Server did not start within 30s.\n${output.slice(-2000)}`));
  }, 30000);

  const onData = (chunk) => {
    output += chunk.toString();
    if (/listening|started|ready/i.test(output) || output.includes(String(PORT))) {
      clearTimeout(timer);
      resolve(child);
    }
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  child.on('exit', (code) => {
    clearTimeout(timer);
    reject(new Error(`Server exited early (code ${code}).\n${output.slice(-2000)}`));
  });
});

const waitForSocket = async (target, timeoutMs = 20000) => {
  const deadline = Date.now() + timeoutMs;
   
  while (Date.now() < deadline) {
    try {
      const probe = await HeadlessPlayer.connect({ url: target, timeoutMs: 3000 });
      probe.close();
      return;
    } catch (error) {
      await new Promise(resolve => { setTimeout(resolve, 500); });
    }
  }
   
  throw new Error(`No playable server at ${target}`);
};

const assert = (condition, label) => {
  if (!condition) {
    throw new Error(`ASSERT FAILED: ${label}`);
  }
  log(`      ✓ ${label}`);
};

const main = async () => {
  const allScenarios = fs.readdirSync(scenariosDir)
    .filter(file => file.endsWith('.mjs'))
    .map(file => file.replace(/\.mjs$/, ''))
    .sort();
  const toRun = requested.length
    ? allScenarios.filter(name => requested.includes(name))
    : allScenarios;

  if (!toRun.length) {
    log(`No matching scenarios. Available: ${allScenarios.join(', ')}`);
    process.exit(2);
  }

  let server = null;
  if (!attach) {
    log(`Booting playtest server on :${PORT}…`);
    server = await startServer();
  }

  try {
    await waitForSocket(url);
    log(`Playing against ${url}\n`);

    const connect = () => HeadlessPlayer.connect({ url });
    const results = [];

     
    for (const name of toRun) {
      log(`  ▶ ${name}`);
      const startedAt = Date.now();
      try {
        const scenario = (await import(`./scenarios/${name}.mjs`)).default;
        await scenario({ connect, assert });
        results.push({ name, ok: true, ms: Date.now() - startedAt });
        log(`  PASS ${name} (${Date.now() - startedAt}ms)\n`);
      } catch (error) {
        results.push({ name, ok: false, ms: Date.now() - startedAt, error });
        log(`  FAIL ${name}: ${error.message}\n`);
      }
      // Let the server settle disconnects between scenarios.
      await new Promise(resolve => { setTimeout(resolve, 700); });
    }
     

    const failed = results.filter(result => !result.ok);
    log('────────────────────────────────');
    results.forEach(result => log(` ${result.ok ? 'PASS' : 'FAIL'}  ${result.name} (${result.ms}ms)`));
    log(`\n${results.length - failed.length}/${results.length} scenarios passed`);
    process.exitCode = failed.length ? 1 : 0;
  } finally {
    if (server) {
      server.kill();
    }
  }
};

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exit(1);
});
