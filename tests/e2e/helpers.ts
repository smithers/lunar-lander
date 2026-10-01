import type { Page } from '@playwright/test';

/** Snapshot of game state from the ?test hook. */
export type Snap = {
  state: string;
  score: number;
  mission: number;
  round: number;
  fuel: number;
  outOfFuel: boolean;
  outcome?: string;
  message: string[];
  zoomed: boolean;
  lever: number;
  lander: { x: number; y: number; vx: number; vy: number; orientation: number };
  highScores: { initials: string; score: number }[];
};

export async function openGame(page: Page, seed = 1): Promise<void> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/?test&seed=${seed}`);
  await page.waitForFunction(() => '__lunar' in window);
  (page as unknown as { __errors: string[] }).__errors = errors;
}

export function pageErrors(page: Page): string[] {
  return (page as unknown as { __errors?: string[] }).__errors ?? [];
}

export const snap = (page: Page) => page.evaluate(() => (window as any).__lunar.snapshot()) as Promise<Snap>;

/** Insert a coin and start a game with the real keyboard, then pause the real-time loop. */
export async function coinAndStart(page: Page): Promise<void> {
  await page.keyboard.press('c');
  await page.waitForFunction(() => (window as any).__lunar.game.state === 'ready');
  await page.keyboard.press('1');
  await page.waitForFunction(() => (window as any).__lunar.game.state === 'playing');
  await page.evaluate(() => (window as any).__lunar.pause());
}

/** Fly a scripted descent onto the pad: bang-bang thrust holding about -6 disp vertical speed. */
export async function scriptedLanding(page: Page, multiplier: number): Promise<void> {
  await page.evaluate((m) => {
    const h = (window as any).__lunar;
    h.placeOverPad(m, 8);
    for (let i = 0; i < 4000 && h.game.state === 'playing'; i++) {
      const vy = h.game.lander.vy;
      h.step(1, { thrustLevel: vy < -384 ? 15 : 0 });
    }
    h.render();
  }, multiplier);
}

/** Count bright pixels in a canvas region (logical 1024x768 coordinates mapped to the canvas). */
export async function brightPixels(page: Page, x: number, y: number, w: number, h: number): Promise<number> {
  return page.evaluate(
    ({ x, y, w, h }) => {
      const c = document.getElementById('screen') as HTMLCanvasElement;
      const scale = Math.min(c.width / 1024, c.height / 768);
      const ox = (c.width - 1024 * scale) / 2;
      const oy = (c.height - 768 * scale) / 2;
      const data = c
        .getContext('2d')!
        .getImageData(Math.round(ox + x * scale), Math.round(oy + y * scale), Math.round(w * scale), Math.round(h * scale)).data;
      let n = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i]! > 128 && data[i + 1]! > 128 && data[i + 2]! > 128) n++;
      return n;
    },
    { x, y, w, h },
  );
}
