import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const projectRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const gamePort = 6512;
const gameUrl = `http://127.0.0.1:${gamePort}`;
const guestSaveDir = path.join(os.tmpdir(), `verdigris-browser-${process.pid}`);
let gameServer = null;
let serverOutput = '';

const waitForServer = async () => {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${gameUrl}/world/players`);
      if (response.ok) {
        return;
      }
    } catch (_error) {
      // Server is still booting.
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
      setTimeout(() => reject(new Error(`Game server did not stop.\n${serverOutput.slice(-3000)}`)), 10000);
    }),
  ]);
  gameServer = null;
};

const loginGuest = async (page) => {
  await page.goto('/?useGuestAccount');
  await expect(page.locator('#guest_account')).toBeChecked();
  await page.locator('button.login').click();
  await expect(page.locator('canvas#game-map')).toBeVisible({ timeout: 30000 });
};

test.describe('browser session resilience', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async () => {
    await startGameServer();
  });

  test.afterEach(async () => {
    await stopGameServer();
  });

  test('stays in game and re-authenticates after a real server restart', async ({ page }) => {
    await loginGuest(page);
    const originalSession = await page.evaluate(() => window.__verdigrisDiagnostics().sessionId);

    await stopGameServer();
    await expect(page.getByText('Connection lost — reconnecting…')).toBeVisible({ timeout: 10000 });

    await startGameServer();
    await expect(page.getByText('Connection lost — reconnecting…')).toBeHidden({ timeout: 30000 });
    await expect(page.locator('canvas#game-map')).toBeVisible();
    await expect(page.locator('button.login')).toBeHidden();

    const diagnostics = await page.evaluate(() => window.__verdigrisDiagnostics());
    expect(diagnostics.sessionId).toBe(originalSession);
    const kinds = diagnostics.records.map(record => record.kind);
    expect(kinds).toContain('socket:close');
    expect(kinds).toContain('socket:auto-login');
    expect(diagnostics.counters['socket:authenticated']).toBeGreaterThanOrEqual(2);
    const gameStarts = diagnostics.records.filter(record => record.kind === 'game:start');
    expect(diagnostics.counters['game:start']).toBe(2);
    expect(gameStarts.at(-1).details.reentry).toBe(true);
    expect(kinds).not.toContain('client:event-handler-error');
    expect(kinds).not.toContain('client:uncaught-error');
  });

  test('shows an explicit notice when a second tab replaces the session', async ({ page, context }) => {
    await loginGuest(page);
    const secondPage = await context.newPage();
    await loginGuest(secondPage);

    await expect(page.getByText('Logged in from another window — this session was signed out.')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('button.login')).toBeVisible();
    await expect(secondPage.locator('canvas#game-map')).toBeVisible();
    const firstPageDiagnostics = await page.evaluate(() => window.__verdigrisDiagnostics());
    const firstPageKinds = firstPageDiagnostics.records.map(record => record.kind);
    expect(firstPageKinds).not.toContain('client:event-handler-error');
    expect(firstPageKinds).not.toContain('client:uncaught-error');
    await secondPage.close();
  });

  test('renders WIZARD item art, shows the vessel tooltip, and equips through the real server', async ({ page }) => {
    await loginGuest(page);
    await page.keyboard.press('i');
    await expect(page.locator('.inventory-pane')).toBeVisible();

    const starterItem = page.locator('.inventory-item[aria-label*="Bronze Pickaxe"]');
    await expect(starterItem.locator('.inventory-item__art')).toBeVisible();
    await starterItem.hover();
    await expect(page.locator('.item-tooltip')).toBeVisible();
    await expect(page.locator('.item-tooltip')).toContainText('Bronze Pickaxe');

    await page.evaluate(() => {
      window.ws.send(JSON.stringify({
        event: 'dev:give',
        data: { itemId: 'bronze-pike', qty: 1 },
      }));
    });

    const pike = page.locator('.inventory-item[aria-label*="Bronze Pike"]');
    await expect(pike).toBeVisible();
    await expect(pike.locator('.inventory-item__art')).toHaveAttribute('src', /boar_pike/i);
    await pike.hover();
    await expect(page.locator('.item-tooltip')).toContainText('Vessel');
    await expect(page.locator('.item-tooltip')).toContainText('Bronze');

    const weaponSlot = page.locator('[data-equipment-slot="right_hand"]');
    const pikeBox = await pike.boundingBox();
    const slotBox = await weaponSlot.boundingBox();
    expect(pikeBox).not.toBeNull();
    expect(slotBox).not.toBeNull();

    await page.mouse.move(
      pikeBox.x + (pikeBox.width / 2),
      pikeBox.y + (pikeBox.height / 2),
    );
    await page.mouse.down();
    await page.mouse.move(
      slotBox.x + (slotBox.width / 2),
      slotBox.y + (slotBox.height / 2),
      { steps: 8 },
    );
    await page.mouse.up();

    await expect(weaponSlot).toHaveAttribute('aria-label', /Bronze Pike/);
    await expect(weaponSlot.locator('.equipment-slot__art')).toHaveAttribute('src', /boar_pike/i);

    const diagnostics = await page.evaluate(() => window.__verdigrisDiagnostics());
    const kinds = diagnostics.records.map(record => record.kind);
    expect(kinds).not.toContain('client:event-handler-error');
    expect(kinds).not.toContain('client:uncaught-error');
  });
});
