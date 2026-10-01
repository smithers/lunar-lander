// World drawing: terrain, pads and labels, the lander and its flame, and crash debris.
import { FLASH_FRAMES, RAW_PER_SB } from '../sim/constants';
import { groundY, type Terrain } from '../sim/terrain';
import { scaleOf, viewSize, worldToScreen, type Camera } from './camera';
import { drawText } from './font';
import type { Vector } from './vector';

type P = { x: number; y: number };

/** Our own LM silhouette, upright, origin at the bottom centre between the feet (screen-bytes). */
const LANDER: P[][] = [
  // descent stage
  [{ x: -2, y: 1.5 }, { x: 2, y: 1.5 }, { x: 2, y: 3 }, { x: -2, y: 3 }, { x: -2, y: 1.5 }],
  // ascent stage
  [
    { x: -1.3, y: 3 },
    { x: -1.3, y: 4.6 },
    { x: -0.6, y: 5.8 },
    { x: 0.6, y: 5.8 },
    { x: 1.3, y: 4.6 },
    { x: 1.3, y: 3 },
  ],
  // legs and feet
  [{ x: -2, y: 2.2 }, { x: -3, y: 0 }],
  [{ x: 2, y: 2.2 }, { x: 3, y: 0 }],
  [{ x: -3.6, y: 0 }, { x: -2.4, y: 0 }],
  [{ x: 2.4, y: 0 }, { x: 3.6, y: 0 }],
  // engine bell
  [{ x: -0.5, y: 1.5 }, { x: -0.9, y: 0.7 }, { x: 0.9, y: 0.7 }, { x: 0.5, y: 1.5 }],
];

/** Small deterministic hash for flame flicker, so screenshots are reproducible. */
const flick = (n: number) => ((Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0) % 1000) / 1000;

function place(x: number, y: number, o: number, p: P): P {
  const phi = ((o - 8) * Math.PI) / 16;
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  return { x: x + p.x * c - p.y * s, y: y + p.x * s + p.y * c };
}

/** The k such that drawing the world at offset k * width covers the view. */
function wrapOffsets(cam: Camera, width: number): number[] {
  const { w } = viewSize(cam.zoomed);
  const first = Math.floor(cam.left / width);
  const last = Math.floor((cam.left + w) / width);
  const ks: number[] = [];
  for (let k = first; k <= last; k++) ks.push(k);
  return ks;
}

export function drawTerrain(v: Vector, cam: Camera, t: Terrain, frame: number): void {
  const { w } = viewSize(cam.zoomed);
  const k = scaleOf(cam);
  for (const off of wrapOffsets(cam, t.width)) {
    const base = off * t.width;
    let started = false;
    for (let i = 0; i < t.points.length; i++) {
      const p = t.points[i]!;
      const wx = base + p.x;
      const next = t.points[i + 1];
      const prev = t.points[i - 1];
      const visible =
        (wx >= cam.left - 1 && wx <= cam.left + w + 1) ||
        (next && base + next.x >= cam.left && wx <= cam.left + w) ||
        (prev && base + prev.x <= cam.left + w && wx >= cam.left);
      if (!visible) {
        started = false;
        continue;
      }
      const s = worldToScreen(cam, wx, p.y);
      if (started) v.lineTo(s.x, s.y);
      else v.moveTo(s.x, s.y);
      started = true;
    }
    // Pad multiplier labels flash 16 frames on, 16 off (spec §7).
    if (((frame / FLASH_FRAMES) & 1) === 0) {
      for (const pad of t.pads) {
        const cx = base + (pad.x0 + pad.x1) / 2;
        if (cx < cam.left - 10 || cx > cam.left + w + 10) continue;
        const s = worldToScreen(cam, cx, pad.y);
        const size = Math.min(16, Math.max(10, 3 * k));
        drawText(v, `${pad.multiplier}X`, s.x, s.y + size + 6, size, 'center');
      }
    }
  }
}

export interface LanderView {
  x: number;
  y: number;
  orientation: number;
  thrust: number;
}

export function drawLander(v: Vector, cam: Camera, l: LanderView, frame: number): void {
  for (const stroke of LANDER) {
    v.poly(stroke.map((p) => worldToScreen(cam, ...xy(place(l.x, l.y, l.orientation, p)))));
  }
  if (l.thrust > 0) {
    const len = (l.thrust >= 16 ? 7 : 1 + (l.thrust / 15) * 4) * (0.8 + 0.4 * flick(frame));
    const flame = [
      { x: -0.7, y: 0.7 },
      { x: 0, y: 0.7 - len },
      { x: 0.7, y: 0.7 },
    ];
    v.poly(flame.map((p) => worldToScreen(cam, ...xy(place(l.x, l.y, l.orientation, p)))));
  }
}

const xy = (p: P): [number, number] => [p.x, p.y];

/** Four debris pieces thrown up at 0x0A00 raw under gravity 0x41 (spec §8). */
const DEBRIS: { vx: number; spin: number; shape: P[] }[] = [
  { vx: -700, spin: 0.21, shape: [{ x: -2, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1.5 }] },
  { vx: 450, spin: -0.17, shape: [{ x: -1.3, y: -1 }, { x: 0, y: 1.2 }, { x: 1.3, y: -1 }] },
  { vx: -250, spin: 0.29, shape: [{ x: 0, y: -1.5 }, { x: 0, y: 1.5 }, { x: 1, y: 1.5 }] },
  { vx: 900, spin: -0.25, shape: [{ x: -1, y: 0 }, { x: 1, y: 0 }] },
];

export function drawDebris(
  v: Vector,
  cam: Camera,
  t: Terrain,
  crash: { x: number; y: number; vx: number },
  frames: number,
): void {
  const g = 0x41;
  for (const d of DEBRIS) {
    const vx = d.vx + crash.vx / 4;
    // Pieces fly until they land, then stay put.
    let n = frames;
    const yAt = (f: number) => crash.y + 3 + (0x0a00 * f - (g * f * f) / 2) / RAW_PER_SB;
    const xAt = (f: number) => crash.x + (vx * f) / RAW_PER_SB;
    for (let f = 1; f <= frames; f++) {
      if (yAt(f) <= groundY(t, xAt(f)) + 0.5) {
        n = f;
        break;
      }
    }
    const cx = xAt(n);
    const cy = Math.max(yAt(n), groundY(t, cx) + 0.5);
    const a = d.spin * n;
    const pts = d.shape.map((p) => {
      const x = cx + p.x * Math.cos(a) - p.y * Math.sin(a);
      const y = cy + p.x * Math.sin(a) + p.y * Math.cos(a);
      return worldToScreen(cam, x, y);
    });
    v.poly(pts);
  }
}
