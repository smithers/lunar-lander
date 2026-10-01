import { expect, test } from '@playwright/test';
import { coinAndStart, openGame, pageErrors } from './helpers';

/**
 * Render cost per frame across the heaviest scenes. At 60 Hz a frame has 16.7 ms; the vector
 * pass must leave most of it free. Measured in Chromium (WebKit cannot run here; see Phase 1).
 */
test('render cost stays well inside a 60 Hz frame in every scene', async ({ page }, info) => {
  await openGame(page, 21);
  await coinAndStart(page);
  const r = await page.evaluate(() => {
    const h = (window as any).__lunar;
    const measure = (n: number, before?: () => void) => {
      const t: number[] = [];
      for (let i = 0; i < n; i++) {
        before?.();
        const a = performance.now();
        h.render();
        t.push(performance.now() - a);
      }
      t.sort((x, y) => x - y);
      return { p50: t[Math.floor(n * 0.5)]!, p95: t[Math.floor(n * 0.95)]!, max: t[n - 1]! };
    };
    const flight = measure(200, () => h.step(1, { thrustLevel: 9 }));
    const flightState = h.game.state;
    // The camera zooms on render, so render while descending into the close-up.
    h.placeOverPad(5, 20, -400);
    for (let i = 0; i < 2000 && !h.camera.zoomed; i++) {
      h.step(1, { thrustLevel: h.game.lander.vy < -600 ? 15 : 0 });
      h.render();
    }
    // Hover in the close-up while measuring (thrust balances gravity at level 9).
    const zoomed = measure(200, () => h.step(1, { thrustLevel: h.game.lander.vy < 0 ? 10 : 8 }));
    const zoomedState = { zoomed: h.camera.zoomed, state: h.game.state };
    h.placeOverPad(2, 4, -60 * 64);
    for (let i = 0; i < 300 && h.game.state === 'playing'; i++) h.step(1);
    const crash = measure(120, () => h.step(1));
    return { flight, flightState, zoomed, zoomedState, crash, crashed: h.game.lastOutcome, crashState: h.game.state };
  });
  await info.attach('render-cost.json', { body: JSON.stringify(r, null, 2), contentType: 'application/json' });
  console.log('render cost (ms):', JSON.stringify(r));
  expect(r.flightState).toBe('playing');
  expect(r.zoomedState).toEqual({ zoomed: true, state: 'playing' });
  expect(r.crashed).toBe('crash');
  expect(r.crashState).toBe('landed');
  for (const scene of [r.flight, r.zoomed, r.crash]) {
    expect(scene.p95).toBeLessThan(8);
  }
  expect(pageErrors(page)).toEqual([]);
});

test('the real-time loop keeps up with the display (frame intervals)', async ({ page }) => {
  await openGame(page, 22);
  await coinAndStart(page);
  await page.evaluate(() => (window as any).__lunar.resume());
  const iv = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const out: number[] = [];
        let last = performance.now();
        const tick = (now: number) => {
          out.push(now - last);
          last = now;
          if (out.length < 240) requestAnimationFrame(tick);
          else resolve(out.slice(10));
        };
        requestAnimationFrame(tick);
      }),
  );
  const sorted = [...iv].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const long = iv.filter((d) => d > median * 1.8).length;
  console.log(`frame interval median ${median.toFixed(2)} ms, long frames ${long}/${iv.length}`);
  // At least 60 Hz (a 120 Hz display gives ~8.3 ms), and almost no frames run long.
  expect(median).toBeLessThan(17.5);
  expect(long / iv.length).toBeLessThan(0.05);
  expect(pageErrors(page)).toEqual([]);
});
