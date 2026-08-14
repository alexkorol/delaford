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

const pointerDrag = async (page, source, target) => {
  const sourceBounds = await source.boundingBox();
  const targetBounds = await target.boundingBox();
  if (!sourceBounds || !targetBounds) {
    throw new Error('Pointer drag source or target has no visible bounds.');
  }

  await page.mouse.move(
    sourceBounds.x + sourceBounds.width / 2,
    sourceBounds.y + sourceBounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBounds.x + targetBounds.width / 2,
    targetBounds.y + targetBounds.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
};

const visibleEmptyInventoryCell = async (page, inventory, footprintHeight = 1) => {
  const grid = inventory.locator('.inventory-grid');
  const cells = grid.locator('.inventory-grid__cell');
  const items = grid.locator('.inventory-item');
  const columns = await grid.evaluate((element) => (
    getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
  ));
  const viewport = page.viewportSize();
  const occupiedBounds = [];

  for (let index = 0; index < await items.count(); index += 1) {
    const bounds = await items.nth(index).boundingBox();
    if (bounds) occupiedBounds.push(bounds);
  }

  const cellCount = await cells.count();
  for (let index = 0; index < cellCount; index += 1) {
    let available = true;
    for (let row = 0; row < footprintHeight; row += 1) {
      const cellIndex = index + (row * columns);
      if (cellIndex >= cellCount) {
        available = false;
        break;
      }

      const bounds = await cells.nth(cellIndex).boundingBox();
      if (!bounds || !viewport || bounds.y < 0 || bounds.y + bounds.height > viewport.height) {
        available = false;
        break;
      }

      const center = {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      };
      if (occupiedBounds.some(item => (
        center.x >= item.x
        && center.x <= item.x + item.width
        && center.y >= item.y
        && center.y <= item.y + item.height
      ))) {
        available = false;
        break;
      }
    }

    if (available) return cells.nth(index);
  }

  throw new Error(`No visible ${footprintHeight}-cell inventory vacancy found.`);
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
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Verdigris' })).toBeVisible();
  await page.getByRole('button', { name: 'Play as Guest', exact: true }).click();
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
  const canvasBoundsWithInventory = await canvas.boundingBox();
  expect(canvasBoundsWithInventory).toEqual(expect.objectContaining({
    width: canvasBounds.width,
    height: canvasBounds.height,
  }));

  const backpackCells = inventory.locator('.inventory-grid__cell');
  await expect(backpackCells).toHaveCount(84);
  const backpackDistribution = await backpackCells.evaluateAll(cells => {
    const bounds = cells.map(cell => cell.getBoundingClientRect());
    return {
      columns: new Set(bounds.map(rect => Math.round(rect.x))).size,
      rows: new Set(bounds.map(rect => Math.round(rect.y))).size,
    };
  });
  expect(backpackDistribution).toEqual({ columns: 12, rows: 7 });
  const firstBackpackCell = await backpackCells.first().boundingBox();
  const lastBackpackCell = await backpackCells.last().boundingBox();
  const inventoryViewport = page.viewportSize();
  expect(firstBackpackCell?.width).toBeGreaterThanOrEqual(50);
  expect(lastBackpackCell && inventoryViewport
    ? lastBackpackCell.y + lastBackpackCell.height
    : Number.POSITIVE_INFINITY).toBeLessThanOrEqual(inventoryViewport?.height || 0);

  await expect(inventory.locator('.inventory-item[aria-label*="Pickaxe"]')).toHaveCount(0);
  await expect(inventory.locator('.inventory-item[aria-label*="Bronze Bar"]')).toHaveCount(0);
  const inventoryItem = inventory.locator('.inventory-item[aria-label^="Bronze Dagger"]');
  const rightHand = inventory.locator('[data-equipment-slot="right_hand"]');

  // The shared development guest is intentionally persistent. A previous
  // browser pass may have left the starter dagger equipped, so normalise it
  // through the server-authored menu before asserting both pointer directions.
  if (!(await inventoryItem.isVisible())) {
    await expect(rightHand).toHaveAttribute('aria-label', /^Bronze Dagger/);
    await rightHand.click({ button: 'right' });
    const unequipAction = page.locator('#actions .action', { hasText: 'Unequip' });
    await expect(unequipAction).toBeVisible();
    await unequipAction.click();
    await expect(inventoryItem).toBeVisible();
  }
  await expect(inventoryItem.locator('.inventory-item__art')).toBeVisible();

  // Find an actually vacant, visible run for the dagger's 1x2 footprint.
  // Persistent browser passes can rearrange the shared development backpack.
  const emptyInventoryCell = await visibleEmptyInventoryCell(page, inventory, 2);

  // Pointer drag must use the same authoritative equip/unequip flow as the
  // context menu, including the reverse trip back into an empty grid cell.
  await pointerDrag(page, inventoryItem, rightHand);
  await expect(rightHand.locator('.wearSlot')).toBeVisible();

  await pointerDrag(page, rightHand, emptyInventoryCell);
  await expect(rightHand.locator('.wearSlot')).toBeHidden();
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
