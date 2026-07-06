/**
 * Soak test: hammer the real gameplay loop (fight → loot → pickup → re-zone
 * → die → respawn) against a dedicated server for a few minutes, watching
 * for the server process to die. Run when chasing "it crashes randomly":
 *
 *   node playtest/soak.mjs            # ~150s soak on :6511
 *   SOAK_SECONDS=600 node playtest/soak.mjs
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

import HeadlessPlayer from './harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const PORT = Number(process.env.SOAK_PORT) || 6511;
const SOAK_SECONDS = Number(process.env.SOAK_SECONDS) || 150;
const url = `ws://localhost:${PORT}`;

const log = line => process.stdout.write(`${line}\n`);
const sleep = ms => new Promise(resolve => { setTimeout(resolve, ms); });

const ZONES = [
  ['grove', 'clearings'],
  ['dungeon', 'warren'],
  ['crypt', 'gauntlet'],
  ['marsh', 'clearings'],
];

const main = async () => {
  let serverExited = null;
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(PORT),
      GUEST_SAVE_DIR: path.join(os.tmpdir(), `verdigris-soak-${Date.now()}`),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverOutput = '';
  server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });
  server.on('exit', (code) => { serverExited = code; });

  // Wait for the server to accept a login
  let probe = null;
  for (let attempt = 0; attempt < 30 && !probe; attempt += 1) {
    try {
      probe = await HeadlessPlayer.connect({ url, timeoutMs: 2000 });
    } catch (error) {
      await sleep(500);
    }
  }
  if (!probe) {
    log('Server never became playable.');
    log(serverOutput.slice(-1500));
    server.kill();
    process.exit(1);
  }
  probe.close();
  await sleep(400);

  const deadline = Date.now() + (SOAK_SECONDS * 1000);
  let cycles = 0;
  let kills = 0;
  let pickups = 0;
  let deaths = 0;

  try {
    while (Date.now() < deadline && serverExited === null) {
      const p = await HeadlessPlayer.connect({ url });
      try {
        const [template, layout] = ZONES[cycles % ZONES.length];
        await p.enterZone(template, layout);
        p.devSetLevel(3 + (cycles % 5));

        const zoneDeadline = Math.min(deadline, Date.now() + 25000);
        while (Date.now() < zoneDeadline && serverExited === null) {
          const s = await p.state();

          if (s.lifecycle !== 'alive') {
            deaths += 1;
            await sleep(4500); // wait out the respawn timer
            continue;
          }

          // Grab any loot underfoot or nearby, both pickup paths.
          const drop = s.groundItems.find(item => (
            Math.abs(item.x - s.x) + Math.abs(item.y - s.y) <= 4));
          if (drop) {
            p.devTeleport(drop.x, drop.y);
            p.pickupUnderfoot();
            pickups += 1;
            await sleep(250);
            continue;
          }

          // Fight the nearest trash mob.
          const target = s.monsters
            .filter(m => m.rarity !== 'elite')
            .sort((a, b) => (Math.abs(a.x - s.x) + Math.abs(a.y - s.y))
              - (Math.abs(b.x - s.x) + Math.abs(b.y - s.y)))[0];
          if (!target) {
            break;
          }
          if (Math.abs(target.x - s.x) > 1.6 || Math.abs(target.y - s.y) > 1.6) {
            p.devTeleport(Math.round(target.x) + 1, Math.round(target.y));
          }
          await p.attack(target);
          if (p.hits.some(hit => hit.died)) {
            kills += p.hits.filter(hit => hit.died).length;
            p.hits.length = 0;
          }
          await sleep(300);
        }
      } finally {
        p.close();
      }
      cycles += 1;
      await sleep(500);
    }
  } catch (error) {
    log(`Soak driver error (server still judged separately): ${error.message}`);
  }

  const verdict = serverExited === null ? 'SERVER SURVIVED' : `SERVER DIED (exit ${serverExited})`;
  log('────────────────────────────────');
  log(`${verdict} — ${cycles} zone cycles, ${kills} kills, ${pickups} pickups, ${deaths} deaths over ${SOAK_SECONDS}s`);
  if (serverExited !== null) {
    log('--- last server output ---');
    log(serverOutput.slice(-3000));
  }
  server.kill();
  process.exit(serverExited === null ? 0 : 1);
};

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exit(1);
});
