import { expect, test } from '@playwright/test';
import { brightPixels, openGame, pageErrors, snap } from './helpers';

const PAGE = 246;

/** Show the attract page that starts at `frame`, on the INSERT COINS "on" phase. */
async function showFrame(page: import('@playwright/test').Page, frame: number) {
  await page.evaluate((f) => {
    const h = (window as any).__lunar;
    h.pause();
    h.game.frame = f;
    h.render();
  }, frame);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(
        'lunar-lander.highscores',
        JSON.stringify({ version: 1, scores: [{ initials: 'JEF', score: 1250 }, { initials: 'AAA', score: 300 }, { initials: 'BOB', score: 75 }] }),
      );
    }
  });
});

test('attract cycles title, high scores and controls, then a coin leaves it', async ({ page }, info) => {
  await openGame(page, 2);
  let s = await snap(page);
  expect(s.state).toBe('attract');

  await showFrame(page, 0);
  expect((await snap(page)).attractPage).toBe('title');
  await page.screenshot({ path: info.outputPath('01-attract-title.png') });
  expect(await brightPixels(page, 250, 145, 524, 50)).toBeGreaterThan(150); // LUNAR LANDER
  expect(await brightPixels(page, 300, 238, 424, 30)).toBeGreaterThan(40); // INSERT COINS
  // All title text sits above the highest possible peak (screen y 367): the band between the
  // per-coin line and that peak line is empty except for terrain, never text.
  expect(await brightPixels(page, 0, 120, 1024, 6)).toBe(0);

  // The game itself advances the pages: step one page's worth of attract frames.
  await page.evaluate((n) => {
    const h = (window as any).__lunar;
    h.step(n);
    h.render();
  }, PAGE);
  expect((await snap(page)).attractPage).toBe('scores');
  await showFrame(page, PAGE);
  await page.screenshot({ path: info.outputPath('02-attract-scores.png') });
  const scores = await snap(page);
  expect(scores.attractPage).toBe('scores');
  expect(scores.highScores).toEqual([
    { initials: 'JEF', score: 1250 },
    { initials: 'AAA', score: 300 },
    { initials: 'BOB', score: 75 },
  ]);
  // Three table rows are drawn, the fourth row is empty, and no terrain is drawn under the table.
  expect(await brightPixels(page, 340, 262, 340, 82)).toBeGreaterThan(150);
  expect(await brightPixels(page, 340, 352, 340, 24)).toBe(0);
  expect(await brightPixels(page, 0, 420, 1024, 180)).toBe(0);

  await showFrame(page, 2 * PAGE);
  await page.screenshot({ path: info.outputPath('03-attract-controls.png') });
  expect(await brightPixels(page, 280, 240, 480, 280)).toBeGreaterThan(400);
  expect(await brightPixels(page, 0, 530, 1024, 70)).toBe(0); // no terrain under the list

  await page.evaluate(() => (window as any).__lunar.resume());
  await page.keyboard.press('5');
  await page.waitForFunction(() => (window as any).__lunar.game.state === 'ready');
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => (window as any).__lunar.game.mission === 1);
  await page.evaluate(() => {
    const h = (window as any).__lunar;
    h.pause();
    h.render();
  });
  await page.screenshot({ path: info.outputPath('04-ready.png') });
  s = await snap(page);
  expect(s.state).toBe('ready');
  expect(s.fuel).toBe(75000);
  expect(await brightPixels(page, 300, 130, 424, 80)).toBeGreaterThan(150); // SELECT OPTION / PUSH START
  // The mission chosen here carries into the game.
  await page.evaluate(() => (window as any).__lunar.resume());
  await page.keyboard.press('1');
  await page.waitForFunction(() => (window as any).__lunar.game.state === 'playing');
  expect((await snap(page)).mission).toBe(1);
  expect(pageErrors(page)).toEqual([]);
});
