// Camera: zoomed-out view of the playfield (about one screen, plus HUD headroom) or the ×4 close-up, with the
// ROM's edge-band scrolling (spec §7). Pure math; the renderer draws in logical screen units.

/** Logical screen (4:3), letterboxed into the window by the renderer. */
export const SCREEN_W = 1024;
export const SCREEN_H = 768;

/** Zoom thresholds in HUD altitude units (spec §7, estimates; hysteresis). */
export const ZOOM_IN_ALT = 100;
export const ZOOM_OUT_ALT = 140;

export interface Camera {
  zoomed: boolean;
  /** World x at the left edge and world y at the bottom edge of the view. */
  left: number;
  bottom: number;
}

interface ShipView {
  x: number;
  y: number;
  vx: number;
}

/**
 * Zoomed-out view height in screen-bytes. One screen of play is 192 tall; the extra headroom
 * keeps the HUD clear of the ship's start height (y = 170.5). Spec §7, estimate.
 */
export const VIEW_H = 220;

export function viewSize(zoomed: boolean): { w: number; h: number } {
  const h = zoomed ? VIEW_H / 4 : VIEW_H;
  return { w: (h * SCREEN_W) / SCREEN_H, h };
}

export function scaleOf(cam: Camera): number {
  return SCREEN_W / viewSize(cam.zoomed).w;
}

export function createCamera(): Camera {
  return { zoomed: false, left: 0, bottom: 0 };
}

/** Round start: zoomed out, ship 16 screen-bytes from the left edge as in the ROM start table. */
export function resetCamera(cam: Camera, ship: { x: number; y: number }): void {
  cam.zoomed = false;
  cam.left = ship.x - 16;
  cam.bottom = 0;
}

export function updateCamera(cam: Camera, ship: ShipView, ground: number, altitudeHud: number): void {
  if (!cam.zoomed && altitudeHud < ZOOM_IN_ALT) {
    cam.zoomed = true;
    const { w } = viewSize(true);
    cam.left = ship.x - w / 2;
    cam.bottom = ground - 6;
  } else if (cam.zoomed && altitudeHud > ZOOM_OUT_ALT) {
    cam.zoomed = false;
    cam.left = ship.x - viewSize(false).w / 2;
    cam.bottom = 0;
  }

  const { w, h } = viewSize(cam.zoomed);
  const band = w / 8;
  const sx = ship.x - cam.left;
  if (sx < 0 || sx > w) cam.left = ship.x - w / 2;
  else if (sx < band && ship.vx < 0) cam.left = ship.x - band;
  else if (sx > w - band && ship.vx > 0) cam.left = ship.x - (w - band);

  if (cam.zoomed) {
    const sy = ship.y - cam.bottom;
    if (sy > h - 6) cam.bottom = ship.y - (h - 6);
    else if (sy < 4) cam.bottom = ship.y - 4;
  } else {
    cam.bottom = 0;
  }
}

export function worldToScreen(cam: Camera, x: number, y: number): { x: number; y: number } {
  const k = scaleOf(cam);
  return { x: (x - cam.left) * k, y: SCREEN_H - (y - cam.bottom) * k };
}
