import { expect, test } from '@playwright/test';

const minimapCoordinates = async (minimap) => {
  const readout = minimap.locator('.world-minimap__readout span').last();
  await expect(readout).toHaveText(/^\d+, \d+$/);
  return readout.textContent();
};

const closeContextMenu = async (page) => {
  const cancel = page.locator('#actions .action', { hasText: 'Cancel' });
  await expect(cancel).toBeVisible();
  await cancel.click();
  await expect(page.locator('#actions')).toBeHidden();
};

const completeChroniclesOnboarding = async (page) => {
  const chronicles = page.getByRole('heading', { name: 'Chronicles' });
  await expect.poll(async () => (
    (await chronicles.isVisible())
    || (await page.locator('#game-map').isVisible())
  )).toBe(true);
  if (!(await chronicles.isVisible())) return;

  const houseName = page.getByLabel('Found a House');
  if (await houseName.isVisible()) {
    await houseName.fill('Gateward');
    await page.getByRole('button', { name: 'Inscribe' }).click();
  }

  const scionName = page.getByLabel('Name a new Scion');
  await expect(scionName).toBeVisible();
  if (await page.locator('.chronicles__scion').count() === 0) {
    await scionName.fill('Wayfarer');
    await page.getByRole('button', { name: 'Add Scion' }).click();
  }

  const setOut = page.getByRole('button', { name: /^Set Out as / });
  await expect(setOut).toBeEnabled();
  await setOut.click();
};

test('the built game supports the browser-critical guest loop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/?useGuestAccount');

  await expect(page.getByRole('heading', { name: 'Verdigris' })).toBeVisible();
  await expect(page.getByLabel('Guest account?')).toBeChecked();
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await completeChroniclesOnboarding(page);

  const canvas = page.locator('canvas[aria-label="Game world"]');
  const minimap = page.getByLabel('World minimap');
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  await expect(minimap).toBeVisible();

  // Movement must keep working after a UI control owns focus.
  const initialCoordinates = await minimapCoordinates(minimap);
  await page.getByRole('button', { name: 'Adventure', exact: true }).click();
  for (const key of ['KeyD', 'KeyS', 'KeyA', 'KeyW']) {
    await page.keyboard.down(key);
    await page.waitForTimeout(350);
    await page.keyboard.up(key);
    if (await minimapCoordinates(minimap) !== initialCoordinates) break;
  }
  await expect.poll(() => minimapCoordinates(minimap)).not.toBe(initialCoordinates);

  // The canvas binding must request and render the server-authored menu.
  const canvasBounds = await canvas.boundingBox();
  if (!canvasBounds) {
    throw new Error('Game canvas has no clickable bounds.');
  }
  await canvas.click({
    button: 'right',
    position: {
      x: Math.round(canvasBounds.width * 0.55),
      y: Math.round(canvasBounds.height * 0.55),
    },
  });
  await expect(page.locator('#actions')).toBeVisible();
  expect(await page.locator('#actions .action').count()).toBeGreaterThan(1);
  await closeContextMenu(page);

  // Inventory items have a separate context-menu binding.
  await page.keyboard.press('KeyI');
  const inventory = page.getByLabel('Inventory panel');
  await expect(inventory).toBeVisible();
  const inventoryItem = inventory.locator('.inventory-item[aria-label]').first();
  await expect(inventoryItem).toBeVisible();
  await inventoryItem.click({ button: 'right' });
  await expect(page.locator('#actions')).toBeVisible();
  await closeContextMenu(page);
  await page.keyboard.press('Escape');

  // Opening, closing, and reopening the skill tree must preserve its summary.
  await page.keyboard.press('KeyP');
  const skillTree = page.getByLabel('Skill Tree overlay');
  await expect(skillTree).toBeVisible();
  const treeSummary = await skillTree.locator('.point-grid').textContent();
  await page.keyboard.press('Escape');
  await expect(skillTree).toBeHidden();
  await page.keyboard.press('KeyP');
  await expect(skillTree).toBeVisible();
  expect(await skillTree.locator('.point-grid').textContent()).toBe(treeSummary);
  await page.keyboard.press('Escape');

  // Adventure must transition through the real WebSocket protocol and update UI state.
  const zoneMenu = page.getByLabel('Choose a zone');
  if (!(await zoneMenu.isVisible())) {
    await page.getByRole('button', { name: 'Adventure', exact: true }).click();
  }
  await zoneMenu.getByRole('button', { name: /Verdant Grove/ }).click();
  await expect(minimap).toContainText('Verdant Grove', { timeout: 15_000 });
});
