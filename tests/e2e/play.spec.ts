import { expect, test } from '@playwright/test';
import { brightPixels, coinAndStart, openGame, pageErrors, scriptedLanding, snap } from './helpers';

test.describe('play: coin → start → land or crash', () => {
  test('a scripted descent lands on a pad and scores', async ({ page }, info) => {
    await openGame(page, 7);
    await coinAndStart(page);
    let s = await snap(page);
    expect(s.state).toBe('playing');
    expect(s.mission).toBe(0);
    expect(s.fuel).toBe(75000);
    await page.screenshot({ path: info.outputPath('01-playing.png') });
    // HUD drawn top-left and top-right.
    expect(await brightPixels(page, 40, 20, 260, 100)).toBeGreaterThan(50);
    expect(await brightPixels(page, 550, 20, 420, 100)).toBeGreaterThan(50);

    await scriptedLanding(page, 3);
    s = await snap(page);
    expect(s.state).toBe('landed');
    expect(s.outcome).toBe('good');
    expect(s.score).toBe(150);
    expect(s.message[0]).toBe('CONGRATULATIONS');
    expect(s.zoomed).toBe(true);
    await page.waitForTimeout(100);
    await page.screenshot({ path: info.outputPath('02-landed.png') });
    // The message is drawn in the centre of the screen.
    expect(await brightPixels(page, 200, 270, 624, 120)).toBeGreaterThan(80);
    expect(pageErrors(page)).toEqual([]);
  });

  test('a fast descent crashes with a crash message and debris', async ({ page }, info) => {
    await openGame(page, 7);
    await coinAndStart(page);
    const site = await page.evaluate(() => {
      const h = (window as any).__lunar;
      h.placeOverPad(2, 6, -45 * 64);
      for (let i = 0; i < 400 && h.game.state === 'playing'; i++) h.step(1);
      h.step(30);
      h.render();
      // Debris flies up from the crash site: a box above the pad, around the crash x.
      const c = h.game.crash;
      const a = h.toScreen(c.x - 6, c.y + 14);
      const b = h.toScreen(c.x + 6, c.y + 1);
      return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
    });
    const s = await snap(page);
    expect(s.state).toBe('landed');
    expect(s.outcome).toBe('crash');
    expect(s.score).toBe(10);
    expect([
      'DESTROYED',
      'YOU CREATED A TWO MILE CRATER',
      'YOU JUST DESTROYED A 100 MEGABUCK LANDER',
      'THERE WERE NO SURVIVORS',
    ]).toContain(s.message[0]);
    await page.waitForTimeout(100);
    await page.screenshot({ path: info.outputPath('03-crashed.png') });
    expect(await brightPixels(page, site.x, site.y, site.w, site.h)).toBeGreaterThan(30);
    expect(pageErrors(page)).toEqual([]);
  });

  test('the close-up shows the lander with a thrust flame near the ground', async ({ page }, info) => {
    await openGame(page, 7);
    await coinAndStart(page);
    const state = await page.evaluate(() => {
      const h = (window as any).__lunar;
      h.placeOverPad(4, 40, -300);
      h.render();
      const before = h.camera.zoomed;
      for (let i = 0; i < 3000 && !h.camera.zoomed; i++) {
        h.step(1, { thrustLevel: h.game.lander.vy < -600 ? 15 : 0 });
        h.render();
      }
      h.step(1, { thrustLevel: 15 });
      h.render();
      return { before, after: h.camera.zoomed, thrust: h.game.lander.thrust, state: h.game.state };
    });
    expect(state).toEqual({ before: false, after: true, thrust: 15, state: 'playing' });
    await page.waitForTimeout(50);
    await page.screenshot({ path: info.outputPath('04-zoomed-thrust.png') });
    // The flame region just below the x4 lander lights up with thrust and goes dark without it.
    const box = await page.evaluate(() => {
      const h = (window as any).__lunar;
      const l = h.game.lander;
      const a = h.toScreen(l.x - 1.5, l.y + 0.5);
      const b = h.toScreen(l.x + 1.5, l.y - 3.5);
      return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
    });
    const lit = await brightPixels(page, box.x, box.y, box.w, box.h);
    await page.evaluate(() => {
      const h = (window as any).__lunar;
      h.game.lander.thrust = 0;
      h.render();
    });
    const dark = await brightPixels(page, box.x, box.y, box.w, box.h);
    expect(lit).toBeGreaterThan(40);
    expect(dark).toBeLessThan(lit / 4);
    expect(pageErrors(page)).toEqual([]);
  });

  test('a new game after a first-round game over resets the camera to the spawn', async ({ page }) => {
    await openGame(page, 11);
    await coinAndStart(page);
    const r = await page.evaluate(() => {
      const h = (window as any).__lunar;
      // End game 1 in round 1: empty tank, hard landing, then wait out the message and game over.
      h.game.lander.fuel = 0;
      h.game.lander.outOfFuel = true;
      h.placeOverPad(2, 3, -20 * 64);
      for (let i = 0; i < 3000 && h.game.state !== 'attract' && h.game.state !== 'initials'; i++) h.step(1);
      // The score qualifies for the empty table: enter initials to get back to attract.
      for (let i = 0; i < 3 && h.game.state === 'initials'; i++) h.step(1, { confirm: true });
      const ended = h.game.state;
      const oldLander = h.game.lander;
      h.step(1, { coin: true });
      h.step(1, { start: true });
      h.render();
      return {
        ended,
        state: h.game.state,
        newLander: h.game.lander !== oldLander,
        round: h.game.round,
        zoomed: h.camera.zoomed,
        off: h.game.lander.x - h.camera.left,
      };
    });
    expect(r.ended).toBe('attract');
    expect(r.state).toBe('playing');
    expect(r.newLander).toBe(true);
    expect(r.round).toBe(1);
    expect(r.zoomed).toBe(false);
    expect(r.off).toBeCloseTo(16, 6);
    expect(pageErrors(page)).toEqual([]);
  });

  test('keyboard drives the lever, rotation and mission select in real time', async ({ page }) => {
    await openGame(page, 3);
    await coinAndStart(page);
    await page.evaluate(() => (window as any).__lunar.resume());
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(() => (window as any).__lunar.snapshot().lever === 15, null, { timeout: 3000 });
    await page.keyboard.up('ArrowUp');
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(() => (window as any).__lunar.snapshot().lander.orientation < 16, null, { timeout: 3000 });
    await page.keyboard.up('ArrowRight');
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => (window as any).__lunar.snapshot().mission === 1, null, { timeout: 3000 });
    const s = await snap(page);
    expect(s.lever).toBe(15);
    expect(s.mission).toBe(1);
    expect(pageErrors(page)).toEqual([]);
  });
});
