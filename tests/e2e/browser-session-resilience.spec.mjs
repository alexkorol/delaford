import { expect, test } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const projectRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const gamePort = 6512;
const gameUrl = `http://127.0.0.1:${gamePort}`;
const guestSaveDir = path.join(os.tmpdir(), `verdigris-reconnect-${process.pid}`);
const chronicleDb = path.join(os.tmpdir(), `verdigris-reconnect-${process.pid}.sqlite`);

let gameServer = null;
let serverOutput = '';

const databaseFiles = () => [chronicleDb, `${chronicleDb}-wal`, `${chronicleDb}-shm`];

const cleanState = () => {
  fs.rmSync(guestSaveDir, { recursive: true, force: true });
  databaseFiles().forEach(file => fs.rmSync(file, { force: true }));
};

const waitForServer = async () => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${gameUrl}/world/players`);
      if (response.ok) return;
    } catch (_error) {
      // The replacement process is still binding its listener.
    }
    await new Promise(resolve => { setTimeout(resolve, 200); });
  }
  throw new Error(`Game server did not start.\n${serverOutput.slice(-3000)}`);
};

const startGameServer = async () => {
  serverOutput = '';
  gameServer = spawn(process.execPath, ['server/index.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(gamePort),
      GUEST_SAVE_DIR: guestSaveDir,
      CHRONICLES_DB_FILE: chronicleDb,
      IDENTITY_DB_FILE: chronicleDb,
      WS_HEARTBEAT_INTERVAL_MS: '1000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  gameServer.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  gameServer.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });
  await waitForServer();
};

const stopGameServer = async () => {
  if (!gameServer || gameServer.exitCode !== null) {
    gameServer = null;
    return;
  }

  const child = gameServer;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGTERM');
  await Promise.race([
    exited,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Game server did not stop.\n${serverOutput.slice(-3000)}`)), 10_000);
    }),
  ]);
  gameServer = null;
};

const loginGuest = async (page) => {
  await page.goto(`${gameUrl}/?play`);
  await expect(page.locator('canvas#game-map')).toBeVisible({ timeout: 30_000 });
};

test.describe('browser session resilience', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(() => {
    cleanState();
  });

  test.afterAll(() => {
    cleanState();
  });

  test.beforeEach(async () => {
    await startGameServer();
  });

  test.afterEach(async () => {
    await stopGameServer();
  });

  test('stays in game and accepts input after a real server restart', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await loginGuest(page);

    const minimapCoordinates = page.locator('.world-minimap__readout span').last();
    await expect(minimapCoordinates).toHaveText(/^\d+, \d+$/);

    await stopGameServer();
    await expect(page.getByText('Connection lost — reconnecting…')).toBeVisible({ timeout: 10_000 });

    await startGameServer();
    await expect(page.getByText('Connection lost — reconnecting…')).toBeHidden({ timeout: 30_000 });
    await expect(page.locator('canvas#game-map')).toBeVisible();
    await expect(page.locator('button.login')).toBeHidden();

    const coordinatesBefore = await minimapCoordinates.textContent();
    for (const key of ['KeyD', 'KeyS', 'KeyA', 'KeyW']) {
      await page.keyboard.down(key);
      await page.waitForTimeout(350);
      await page.keyboard.up(key);
      if (await minimapCoordinates.textContent() !== coordinatesBefore) break;
    }
    await expect.poll(() => minimapCoordinates.textContent()).not.toBe(coordinatesBefore);
    expect(pageErrors).toEqual([]);
  });

  test('shows an explicit notice when another tab replaces the session', async ({ page, context }) => {
    await loginGuest(page);
    const secondPage = await context.newPage();
    await loginGuest(secondPage);

    await expect(page.getByText('Logged in from another window — this session was signed out.')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('button.login')).toBeVisible();
    await expect(secondPage.locator('canvas#game-map')).toBeVisible();
    await secondPage.close();
  });
});
