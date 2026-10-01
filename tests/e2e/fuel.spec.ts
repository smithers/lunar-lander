import { expect, test } from '@playwright/test';
import { coinAndStart, openGame, pageErrors, snap } from './helpers';

test('a mid-game coin raises the HUD fuel by 750 units', async ({ page }, info) => {
  await openGame(page, 4);
  await coinAndStart(page);
  await page.evaluate(() => {
    const h = (window as any).__lunar;
    h.step(40, { thrustLevel: 15 });
    h.render();
  });
  const before = await snap(page);
  expect(before.state).toBe('playing');
  const hudBefore = await page.screenshot({ clip: await fuelClip(page), path: info.outputPath('01-fuel-before.png') });

  // Real key press while the game runs in real time.
  await page.evaluate(() => (window as any).__lunar.resume());
  await page.keyboard.press('c');
  await page.waitForFunction((f) => (window as any).__lunar.game.lander.fuel > f + 70000, before.fuel);
  await page.evaluate(() => {
    const h = (window as any).__lunar;
    h.pause();
    h.render();
  });
  const after = await snap(page);
  expect(after.fuel - before.fuel).toBeGreaterThan(75000 - 2000); // minus a few frames of burn
  expect(after.fuel - before.fuel).toBeLessThanOrEqual(75000);
  const hudAfter = await page.screenshot({ clip: await fuelClip(page), path: info.outputPath('02-fuel-after.png') });
  expect(hudAfter.equals(hudBefore)).toBe(false);
  await page.screenshot({ path: info.outputPath('03-full.png') });
  expect(pageErrors(page)).toEqual([]);
});

/** The FUEL value in the HUD, in CSS pixels. */
async function fuelClip(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const scale = Math.min(innerWidth / 1024, innerHeight / 768);
    const ox = (innerWidth - 1024 * scale) / 2;
    const oy = (innerHeight - 768 * scale) / 2;
    return { x: ox + 170 * scale, y: oy + 84 * scale, width: 90 * scale, height: 26 * scale };
  });
}
