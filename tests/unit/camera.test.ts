import { describe, expect, it } from 'vitest';
import {
  createCamera,
  scaleOf,
  resetCamera,
  SCREEN_H,
  SCREEN_W,
  updateCamera,
  viewSize,
  worldToScreen,
  ZOOM_IN_ALT,
  ZOOM_OUT_ALT,
} from '../../src/render/camera';

const ship = (x: number, y: number, vx = 0) => ({ x, y, vx });

describe('camera zoom (spec §7)', () => {
  it('zooms in below ZOOM_IN_ALT and out above ZOOM_OUT_ALT, with hysteresis', () => {
    expect(ZOOM_OUT_ALT).toBeGreaterThan(ZOOM_IN_ALT);
    const cam = createCamera();
    resetCamera(cam, ship(100, 150));
    updateCamera(cam, ship(100, 60), 20, ZOOM_IN_ALT + 1);
    expect(cam.zoomed).toBe(false);
    updateCamera(cam, ship(100, 40), 20, ZOOM_IN_ALT - 1);
    expect(cam.zoomed).toBe(true);
    updateCamera(cam, ship(100, 45), 20, (ZOOM_IN_ALT + ZOOM_OUT_ALT) / 2);
    expect(cam.zoomed).toBe(true);
    updateCamera(cam, ship(100, 70), 20, ZOOM_OUT_ALT + 1);
    expect(cam.zoomed).toBe(false);
  });
  it('the close-up is x4 and keeps the ground and ship in view on switching', () => {
    expect(viewSize(false).w / viewSize(true).w).toBe(4);
    const cam = createCamera();
    resetCamera(cam, ship(500, 150));
    updateCamera(cam, ship(500, 50), 22, ZOOM_IN_ALT - 1);
    const s = worldToScreen(cam, 500, 50);
    const g = worldToScreen(cam, 500, 22);
    expect(s.x).toBeGreaterThan(0);
    expect(s.x).toBeLessThan(SCREEN_W);
    expect(s.y).toBeGreaterThan(0);
    expect(g.y).toBeLessThan(SCREEN_H);
    expect(g.y).toBeGreaterThan(s.y);
  });
});

describe('camera scrolling', () => {
  it('starts the round with the ship near the left of the screen', () => {
    const cam = createCamera();
    resetCamera(cam, ship(700, 170));
    expect(worldToScreen(cam, 700, 170).x).toBeCloseTo(16 * scaleOf(cam), 6);
    // The start height sits below the HUD rows (top ~110 logical px).
    expect(worldToScreen(cam, 700, 170.5 + 6).y).toBeGreaterThan(120);
  });
  it('freezes the ship at the 1/8 band and scrolls the terrain when moving outward', () => {
    const cam = createCamera();
    resetCamera(cam, ship(100, 150));
    for (let x = 100; x < 400; x += 1) updateCamera(cam, ship(x, 150, 1000), 20, 500);
    expect(worldToScreen(cam, 399, 150).x).toBeCloseTo((7 / 8) * SCREEN_W, 6);
    for (let x = 399; x > 0; x -= 1) updateCamera(cam, ship(x, 150, -1000), 20, 500);
    expect(worldToScreen(cam, 1, 150).x).toBeCloseTo((1 / 8) * SCREEN_W, 6);
  });
  it('maps world to screen with y up and the bottom of the view at the bottom of the screen', () => {
    const cam = createCamera();
    resetCamera(cam, ship(16, 100));
    expect(worldToScreen(cam, cam.left, 0)).toEqual({ x: 0, y: SCREEN_H });
    const { w, h } = viewSize(false);
    const tr = worldToScreen(cam, cam.left + w, h);
    expect(tr.x).toBeCloseTo(SCREEN_W, 9);
    expect(tr.y).toBeCloseTo(0, 9);
  });
});
