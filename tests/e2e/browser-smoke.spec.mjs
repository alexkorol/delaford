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

  test('creates a local account and returns to sign-in with the username', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('ui', JSON.stringify({
        account: {
          username: 'OldSavedAccount',
          password: 'plaintext-legacy-password',
        },
        guestAccount: true,
        rememberMe: true,
      }));
    });
    await page.goto(`${gameUrl}/?#autologin`);
    await expect(page.getByRole('button', { name: 'Continue as browser guest' })).toBeVisible();
    await expect(page.getByText('Separate browser-local Chronicle')).toBeVisible();
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('button', { name: 'Play Now' })).toHaveCount(0);
    await expect(page.getByText('Guest account?')).toHaveCount(0);
    await expect(page.locator('#login-username')).toHaveValue('OldSavedAccount');
    await expect(page.locator('#login-password')).toHaveValue('');
    await expect(page.locator('.inputs')).not.toContainText('qwertykeyboard');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await page.getByLabel('Username').fill('SmokeFounder');
    await page.getByLabel('Password', { exact: true }).fill('smoke-passphrase');
    await page.getByLabel('Confirm password').fill('smoke-passphrase');
    await page.getByRole('button', { name: 'Create account', exact: true }).click();

    await expect(page.locator('#login-username')).toHaveValue('SmokeFounder');
    await expect(page.locator('#login-password')).toHaveValue('');
    await expect(page.getByRole('status')).toContainText('Account created.');
    await expect(page.locator('.error_message')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('ui')))
      .not.toContain('plaintext-legacy-password');

    await page.locator('#login-password').fill('smoke-passphrase');
    const loginTransition = await page.evaluate(() => new Promise((resolve) => {
      const samples = [];
      const timer = window.setInterval(() => {
        const username = document.querySelector('#login-username')?.value;
        const password = document.querySelector('#login-password')?.value;
        if (username !== undefined || password !== undefined) samples.push([username, password]);
      }, 5);
      document.querySelector('button.login')?.click();
      Promise.resolve().then(() => {
        const submitted = {
          progressVisible: Boolean(document.querySelector('.login_progress')),
          usernameFieldPresent: Boolean(document.querySelector('#login-username')),
          passwordFieldPresent: Boolean(document.querySelector('#login-password')),
        };
        window.setTimeout(() => {
          window.clearInterval(timer);
          resolve({ samples, submitted });
        }, 750);
      });
    }));
    expect(loginTransition.submitted).toEqual({
      progressVisible: true,
      usernameFieldPresent: false,
      passwordFieldPresent: false,
    });
    expect(loginTransition.samples.flat()).not.toContain('dev');
    expect(loginTransition.samples.flat()).not.toContain('qwertykeyboard');
    await expect(page.getByRole('heading', { name: 'Found Your House' })).toBeVisible();
  });

  test('protects movement, context menus, tree persistence, quests, and zone labels', async ({ page }) => {
    await page.goto(`${gameUrl}/?play`);
    const canvas = page.locator('canvas#game-map');
    await expect(canvas).toBeVisible({ timeout: 30000 });
    await page.evaluate(() => {
      window.ws.send(JSON.stringify({ event: 'dev:setlevel', data: { level: 5 } }));
      window.ws.send(JSON.stringify({ event: 'dev:heal', data: {} }));
    });

    await page.keyboard.press('Escape');
    const escapeMenu = page.locator('.escape-menu');
    await expect(escapeMenu).toBeVisible();
    await expect(escapeMenu.getByRole('button')).toHaveCount(7);
    await expect(escapeMenu.getByRole('button', { name: 'Resume Esc' })).toBeFocused();
    await escapeMenu.getByRole('button', { name: 'Settings' }).click();
    await expect(page.locator('.settings')).toBeVisible();
    await expect(page.getByLabel('Frame rate cap')).toHaveValue('5');
    await expect(page.getByLabel('Sound effects')).toBeChecked();
    await page.getByLabel('Sound effects').uncheck();
    await expect(escapeMenu).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('.settings')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(escapeMenu).toBeVisible();
    await escapeMenu.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByLabel('Sound effects')).not.toBeChecked();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(escapeMenu).toBeVisible();
    await escapeMenu.getByRole('button', { name: 'Resume Esc' }).click();
    await expect(escapeMenu).toBeHidden();

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

    await page.evaluate(() => {
      window.ws.send(JSON.stringify({ event: 'dev:setlevel', data: { level: 20 } }));
    });
    await page.keyboard.press('p');
    const tree = page.locator('.geometric-skill-tree');
    await expect(tree).toBeVisible();
    await expect(tree.locator('.point-grid strong').first()).toHaveText('20');
    const activeNodes = tree.locator('.node-group.active');
    const activeBefore = await activeNodes.count();
    for (const nodeId of ['1,0', '2,0', '3,0', '4,0', '5,0', '6,0', '7,0']) {
      await tree.locator(`[data-node-id="${nodeId}"]`).evaluate(element => {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      const pendingChoice = tree.locator('.choice-panel .choice-btn:not(.danger)').first();
      if (await pendingChoice.isVisible()) await pendingChoice.click();
    }
    await expect.poll(() => activeNodes.count()).toBe(activeBefore + 7);
    await expect(tree.getByLabel('Calling and armoury unlocks')).toContainText('Archmage');
    const activeAfter = await activeNodes.count();
    await page.keyboard.press('Escape');
    await expect(tree).toBeHidden();
    await page.keyboard.press('p');
    await expect(tree).toBeVisible();
    await expect.poll(() => activeNodes.count()).toBe(activeAfter);
    await page.keyboard.press('Escape');

    await page.keyboard.press('i');
    const attendantTab = page.getByRole('button', { name: 'Open Attendant' });
    await expect(attendantTab).toBeVisible();
    await attendantTab.click();
    await expect(page.getByRole('complementary', { name: 'Attendant' })).toBeVisible();
    await page.keyboard.press('i');

    await page.evaluate(() => {
      window.ws.send(JSON.stringify({
        event: 'dev:teleport',
        data: { x: 31, y: 121, sceneId: 'town:delaford' },
      }));
    });
    await expect(minimapCoords).toContainText('31, 121');
    await canvas.click({ button: 'right', position: { x: 610, y: 300 } });
    await page.getByText('Bank Rhea, House Banker', { exact: true }).click();
    const houseTransfer = page.getByRole('region', { name: 'House treasury transfer' });
    await expect(houseTransfer).toBeVisible();
    await expect(houseTransfer.getByRole('button')).toHaveCount(2);
    await expect(houseTransfer).toContainText('Carried by this scion');
    const transferBalances = houseTransfer.locator('strong');
    await expect(transferBalances.nth(0)).toHaveText('100 gold');
    const treasuryBefore = Number.parseInt(await transferBalances.nth(1).innerText(), 10);
    await houseTransfer.getByRole('button', { name: 'Deposit 100' }).click();
    await expect(transferBalances.nth(0)).toHaveText('0 gold');
    await expect(transferBalances.nth(1)).toHaveText(`${treasuryBefore + 100} gold`);
    const closeLegacyPane = page.getByRole('button', { name: 'Close current pane' });
    await expect(closeLegacyPane).toBeVisible();
    await closeLegacyPane.click();
    await expect(houseTransfer).toBeHidden();
    await page.keyboard.press('Escape');

    await canvas.click({ button: 'right', position: { x: 610, y: 300 } });
    await page.getByText('Bank Rhea, House Banker', { exact: true }).click();
    await expect(houseTransfer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(houseTransfer).toBeHidden();
    await page.keyboard.press('Escape');

    await adventure.click();
    await page.getByRole('button', { name: 'Verdant Grove Lv 1–6', exact: true }).click();
    await expect(page.locator('.world-minimap__readout')).toContainText('Verdant Grove');
  });

  test('keeps the game menu and inventory contained on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 800 });
    await page.goto(`${gameUrl}/?play`);

    const canvas = page.locator('canvas#game-map');
    await expect(canvas).toBeVisible({ timeout: 30000 });
    await page.keyboard.press('Escape');

    const escapeMenu = page.locator('.escape-menu');
    await expect(escapeMenu).toBeVisible();
    await expect.poll(() => page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 480, document: 480 });

    const menuBounds = await escapeMenu.boundingBox();
    expect(menuBounds).toBeTruthy();
    expect(menuBounds.x).toBeGreaterThanOrEqual(0);
    expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(480);
    expect(menuBounds.y).toBeGreaterThanOrEqual(0);
    expect(menuBounds.y + menuBounds.height).toBeLessThanOrEqual(800);

    await escapeMenu.getByRole('button', { name: 'Inventory I' }).click();
    const inventory = page.getByRole('region', { name: 'Inventory panel' });
    await expect(inventory).toBeVisible();
    await expect(page.getByLabel('Unlocked auxiliary windows')).toHaveCount(0);
    const inventoryBounds = await inventory.boundingBox();
    expect(inventoryBounds).toBeTruthy();
    expect(inventoryBounds.x).toBeGreaterThanOrEqual(0);
    expect(inventoryBounds.x + inventoryBounds.width).toBeLessThanOrEqual(480);
    expect(inventoryBounds.y).toBeGreaterThanOrEqual(0);
    expect(inventoryBounds.y + inventoryBounds.height).toBeLessThanOrEqual(800);
  });
});
