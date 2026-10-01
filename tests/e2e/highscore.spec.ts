import { expect, test, type Page } from '@playwright/test';
import { brightPixels, coinAndStart, openGame, pageErrors, snap } from './helpers';

/** Land a good 5x landing (250 points) on an empty tank so the game ends after the message. */
async function qualifyingGame(page: Page) {
  await coinAndStart(page);
  await page.evaluate(() => {
    const h = (window as any).__lunar;
    h.placeOverPad(5, 2, -300);
    for (let i = 0; i < 400 && h.game.state === 'playing'; i++) h.step(1, { thrustLevel: h.game.lander.vy < -384 ? 15 : 0 });
    // Empty the tank (the +50 perfect-landing bonus included) so the game ends.
    h.game.lander.fuel = 0;
    h.game.lander.outOfFuel = true;
    for (let i = 0; i < 1000 && h.game.state !== 'gameOver'; i++) h.step(1);
    h.render();
  });
  // GAME OVER and the final score are drawn above the terrain.
  expect((await snap(page)).state).toBe('gameOver');
  expect(await brightPixels(page, 330, 195, 364, 40)).toBeGreaterThan(150); // GAME OVER
  expect(await brightPixels(page, 380, 268, 264, 26)).toBeGreaterThan(60); // SCORE 250
  await page.evaluate(() => {
    const h = (window as any).__lunar;
    for (let i = 0; i < 1000 && h.game.state !== 'initials'; i++) h.step(1);
    h.render();
  });
}

/** The three initials letters (and only them) are drawn in the letters row. */
async function letterPixels(page: Page) {
  return brightPixels(page, 420, 415, 184, 50);
}

/** Enter C, B, A with real key presses: Right steps forward, Space confirms. */
async function enterInitials(page: Page) {
  await page.evaluate(() => (window as any).__lunar.resume());
  const press = async (key: string) => {
    await page.keyboard.press(key);
    await page.waitForTimeout(80); // a few frames apart, like a person
  };
  await press('ArrowRight');
  await press('ArrowRight');
  await press('Space');
  await press('ArrowRight');
  await press('Space');
  await press('Space');
  await page.waitForFunction(() => (window as any).__lunar.game.state === 'attract');
}

test('a qualifying score goes to initials entry, is saved, and survives a reload', async ({ page }, info) => {
  await openGame(page, 9);
  await qualifyingGame(page);
  let s = await snap(page);
  expect(s.state).toBe('initials');
  expect(s.score).toBe(250);
  await page.screenshot({ path: info.outputPath('01-initials.png') });
  expect(await letterPixels(page)).toBeGreaterThan(150);
  expect(await brightPixels(page, 380, 190, 264, 50)).toBeGreaterThan(100); // GREAT SCORE
  await enterInitials(page);
  s = await snap(page);
  expect(s.highScores).toEqual([{ initials: 'CBA', score: 250 }]);

  await page.reload();
  await page.waitForFunction(() => '__lunar' in window);
  s = await snap(page);
  expect(s.highScores).toEqual([{ initials: 'CBA', score: 250 }]);
  await page.evaluate(() => {
    const h = (window as any).__lunar;
    h.pause();
    h.game.frame = 246;
    h.render();
  });
  await page.screenshot({ path: info.outputPath('02-table-after-reload.png') });
  expect(pageErrors(page)).toEqual([]);
});

test('with storage blocked the game still runs and keeps scores in memory', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('storage blocked');
      },
    });
  });
  await openGame(page, 9);
  await qualifyingGame(page);
  expect((await snap(page)).state).toBe('initials');
  await enterInitials(page);
  expect((await snap(page)).highScores).toEqual([{ initials: 'CBA', score: 250 }]);
  expect(pageErrors(page)).toEqual([]);
});
