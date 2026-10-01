import { expect, test } from '@playwright/test';

test('page loads with a full-window black canvas', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const canvas = page.locator('canvas#screen');
  await expect(canvas).toBeVisible();
  const vp = page.viewportSize();
  const box = await canvas.boundingBox();
  expect(box?.width).toBe(vp?.width);
  expect(box?.height).toBe(vp?.height);
  // The backing store is sized by main.ts (CSS size * devicePixelRatio) and painted black.
  const info = await page.evaluate(() => {
    const c = document.getElementById('screen') as HTMLCanvasElement;
    const px = c.getContext('2d')!.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
    return { w: c.width, h: c.height, dpr: window.devicePixelRatio, px: Array.from(px) };
  });
  expect(info.w).toBe(Math.round(vp!.width * info.dpr));
  expect(info.h).toBe(Math.round(vp!.height * info.dpr));
  expect(info.px).toEqual([0, 0, 0, 255]);
  expect(errors).toEqual([]);
});
