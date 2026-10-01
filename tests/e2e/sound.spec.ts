import { expect, test } from '@playwright/test';
import { coinAndStart, openGame, pageErrors } from './helpers';

test('coin → start → thrust → crash records the expected sound sequence', async ({ page }) => {
  await openGame(page, 5);
  // The first key press is the user gesture that unlocks audio.
  await coinAndStart(page);
  const log = await page.evaluate(() => {
    const h = (window as any).__lunar;
    h.step(20, { thrustLevel: 15 });
    h.step(5, { thrustLevel: 0 });
    h.game.lander.fuel = 9000; // below the low-fuel line: the beep gates with the flash
    h.step(40, { thrustLevel: 0 });
    h.placeOverPad(2, 3, -40 * 64);
    for (let i = 0; i < 200 && h.game.state === 'playing'; i++) h.step(1);
    h.step(2);
    return h.audioLog();
  });
  expect(log[0]).toBe('coin');
  const i7 = log.indexOf('thrust:7');
  const i1 = log.indexOf('thrust:1', i7);
  const iBeep = log.indexOf('beep:on');
  const iBoom = log.indexOf('explosion');
  expect(i7).toBeGreaterThan(0);
  expect(i1).toBeGreaterThan(i7);
  expect(iBeep).toBeGreaterThan(i1);
  expect(log.indexOf('beep:off', iBeep)).toBeGreaterThan(iBeep);
  expect(iBoom).toBeGreaterThan(iBeep);
  // The crash ends the round in the same frame, so the rumble stops (thrust:0) just before the boom.
  const thrusts = log.filter((l: string) => l.startsWith('thrust:'));
  expect(thrusts[thrusts.length - 1]).toBe('thrust:0');
  expect(log.lastIndexOf('thrust:0')).toBe(iBoom - 1);
  expect(pageErrors(page)).toEqual([]);
});

test('M toggles mute', async ({ page }) => {
  await openGame(page, 5);
  await page.keyboard.press('c');
  await page.keyboard.press('m');
  await page.waitForFunction(() => (window as any).__lunar.muted() === true);
  await page.keyboard.press('m');
  await page.waitForFunction(() => (window as any).__lunar.muted() === false);
  expect(pageErrors(page)).toEqual([]);
});

test('rendered audio: the rumble is low band-limited noise, the beep is 3 kHz, no clicks', async ({ page }) => {
  await openGame(page, 5);
  const r = await page.evaluate(async () => {
    // Served by the Vite dev server; a non-literal specifier keeps tsc from resolving it.
    const modulePath = '/src/audio/synth.ts';
    const { createSynth } = await import(/* @vite-ignore */ modulePath);
    const sr = 48000;
    const ev = (e: Record<string, unknown>) => ({
      thrustLevel: 0, lowFuel: false, outOfFuel: false, coin: false, abort: false, crash: false, gameOver: false, ...e,
    });
    async function render(setup: (s: any, ctx: OfflineAudioContext) => void) {
      const ctx = new OfflineAudioContext(1, sr, sr);
      const s = createSynth({ create: () => ctx as any });
      s.unlock();
      setup(s, ctx);
      return (await ctx.startRendering()).getChannelData(0);
    }
    /** Fraction of spectral power below `hz`, and the peak bin frequency, over a 4096-sample window. */
    function spectrum(x: Float32Array, start: number) {
      const N = 4096;
      let below = 0, total = 0, peak = 0, peakHz = 0;
      for (let k = 1; k < N / 2; k++) {
        let re = 0, im = 0;
        for (let n = 0; n < N; n++) {
          const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (N - 1));
          const v = x[start + n]! * w;
          re += v * Math.cos((2 * Math.PI * k * n) / N);
          im -= v * Math.sin((2 * Math.PI * k * n) / N);
        }
        const p = re * re + im * im;
        const hz = (k * sr) / N;
        total += p;
        if (hz < 600) below += p;
        if (p > peak) { peak = p; peakHz = hz; }
      }
      return { lowFrac: below / total, peakHz };
    }
    const rms = (x: Float32Array, a: number, b: number) => {
      let s = 0;
      for (let i = a; i < b; i++) s += x[i]! * x[i]!;
      return Math.sqrt(s / (b - a));
    };
    const full = await render((s) => s.frame(ev({ thrustLevel: 15 }), true));
    const idle = await render((s) => s.frame(ev({ thrustLevel: 0 }), true));
    const beep = await render((s) => s.frame(ev({ lowFuel: true }), false));
    let maxStep = 0;
    for (let i = 1; i < full.length; i++) maxStep = Math.max(maxStep, Math.abs(full[i]! - full[i - 1]!));
    return {
      rumble: spectrum(full, 20000),
      beep: spectrum(beep, 20000),
      fullRms: rms(full, 10000, 40000),
      idleRms: rms(idle, 10000, 40000),
      maxStep,
      peakAbs: Math.max(...Array.from(full).map(Math.abs)),
    };
  });
  expect(r.rumble.lowFrac).toBeGreaterThan(0.9);
  expect(r.beep.peakHz).toBeGreaterThan(2950);
  expect(r.beep.peakHz).toBeLessThan(3050);
  // Full thrust is clearly louder than the faint always-on idle rumble (volume 7 vs 1).
  expect(r.fullRms).toBeGreaterThan(4 * r.idleRms);
  expect(r.idleRms).toBeGreaterThan(0);
  // No clipping and no sample-to-sample jumps (clicks) in the thrust signal.
  expect(r.peakAbs).toBeLessThan(1);
  expect(r.maxStep).toBeLessThan(0.1);
});
