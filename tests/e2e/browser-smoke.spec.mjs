import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const projectRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const gamePort = 6514;
const gameUrl = `http://127.0.0.1:${gamePort}`;
const guestSaveDir = path.join(os.tmpdir(), `verdigris-browser-smoke-${process.pid}`);
const chronicleDb = path.join(os.tmpdir(), `verdigris-browser-smoke-${process.pid}.sqlite`);
let gameServer = null;
let serverOutput = '';

const waitForServer = async () => {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${gameUrl}/world/players`);
      if (response.ok) return;
    } catch (_error) {
      // Server is still booting.
    }
    await new Promise(resolve => { setTimeout(resolve, 200); });
  }
  throw new Error(`Game server did not start.\n${serverOutput.slice(-3000)}`);
};

const cleanState = () => {
  fs.rmSync(guestSaveDir, { recursive: true, force: true });
  [chronicleDb, `${chronicleDb}-wal`, `${chronicleDb}-shm`]
    .forEach(file => fs.rmSync(file, { force: true }));
};

test.describe('canonical browser smoke', () => {
  test.beforeAll(async () => {
    cleanState();
    gameServer = spawn(process.execPath, ['server/index.js'], {
      cwd: projectRoot,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: String(gamePort),
        GUEST_SAVE_DIR: guestSaveDir,
        CHRONICLES_DB_FILE: chronicleDb,
        IDENTITY_DB_FILE: chronicleDb,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    gameServer.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
    gameServer.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });
    await waitForServer();
  });

  test.afterAll(async () => {
    if (gameServer && gameServer.exitCode === null) {
      const exited = new Promise(resolve => gameServer.once('exit', resolve));
      gameServer.kill('SIGTERM');
      await Promise.race([exited, new Promise(resolve => { setTimeout(resolve, 5000); })]);
    }
    cleanState();
  });

  test('protects movement, context menus, tree persistence, quests, and zone labels', async ({ page }) => {
    await page.goto(`${gameUrl}/?play`);
    const canvas = page.locator('canvas#game-map');
    await expect(canvas).toBeVisible({ timeout: 30000 });
    await page.evaluate(() => {
      window.ws.send(JSON.stringify({ event: 'dev:setlevel', data: { level: 5 } }));
      window.ws.send(JSON.stringify({ event: 'dev:heal', data: {} }));
    });

    await page.keyboard.press('q');
    await expect(page.locator('.quests')).toContainText('Speak with Aldwyn the Guide in Delaford.');
    await expect(page.locator('.quests')).toContainText('1 Verdigris point');
    await page.keyboard.press('Escape');

    const minimapCoords = page.locator('.world-minimap__readout span').last();
    const adventure = page.getByRole('button', { name: 'Adventure', exact: true });
    const coordsBefore = await minimapCoords.innerText();
    await adventure.click();
    await page.keyboard.press('d');
    await expect.poll(() => minimapCoords.innerText()).not.toBe(coordsBefore);
    await adventure.click();

    await canvas.click({ button: 'right' });
    await expect(page.locator('#actions')).toBeVisible();
    await expect(page.locator('#actions')).toContainText('Walk here');
    await page.getByText('Cancel', { exact: true }).click();

    await page.keyboard.press('i');
    const pickaxe = page.locator('.inventory-item[aria-label^="Bronze Pickaxe"]');
    await expect(pickaxe).toBeVisible();
    await pickaxe.click({ button: 'right' });
    await expect(page.locator('#actions')).toBeVisible();
    await page.getByText('Cancel', { exact: true }).click();
    await page.keyboard.press('i');

    await page.keyboard.press('p');
    const tree = page.locator('.geometric-skill-tree');
    await expect(tree).toBeVisible();
    const activeNodes = tree.locator('.node-group.active');
    const activeBefore = await activeNodes.count();
    await tree.locator('.node-group.available').first().click({ force: true });
    const pendingChoice = tree.locator('.choice-panel .choice-btn:not(.danger)').first();
    if (await pendingChoice.isVisible()) await pendingChoice.click();
    await expect.poll(() => activeNodes.count()).toBeGreaterThan(activeBefore);
    const activeAfter = await activeNodes.count();
    await page.keyboard.press('Escape');
    await expect(tree).toBeHidden();
    await page.keyboard.press('p');
    await expect(tree).toBeVisible();
    await expect.poll(() => activeNodes.count()).toBe(activeAfter);
    await page.keyboard.press('Escape');

    await adventure.click();
    await page.getByRole('button', { name: 'Verdant Grove Lv 1–6', exact: true }).click();
    await expect(page.locator('.world-minimap__readout')).toContainText('Verdant Grove');
  });
});
