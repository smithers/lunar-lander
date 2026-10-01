// Seeded, wrapping terrain with flat multiplier pads (spec §7). Our own generator — no ROM data.
import { WORLD } from './constants';
import type { Rng } from './rng';

export interface Point {
  x: number;
  y: number;
}

export interface Pad {
  x0: number;
  x1: number;
  y: number;
  multiplier: number;
}

export interface Terrain {
  width: number;
  /** Polyline from x=0 to x=width; the last point's y equals the first's (wraps). */
  points: Point[];
  pads: Pad[];
}

export function wrapX(x: number, width: number = WORLD.width): number {
  return ((x % width) + width) % width;
}

const clampY = (y: number) => Math.max(WORLD.minGround, Math.min(WORLD.maxGround, y));

/** Pick a height for a jagged point that differs from `prev` by at least minSlopeRise. */
function jag(prev: number, target: number, rng: Rng): number {
  const rise = WORLD.minSlopeRise;
  let y = clampY(target + (rng.next() - 0.5) * 60);
  if (Math.abs(y - prev) < rise) y = prev + rise * 1.5 <= WORLD.maxGround ? prev + rise * 1.5 : prev - rise * 1.5;
  return y;
}

/** Jagged fill from (xa, ya) to (xb, yb), exclusive of both ends. */
function fill(out: Point[], xa: number, ya: number, xb: number, yb: number, rng: Rng): void {
  const rise = WORLD.minSlopeRise;
  const mids: Point[] = [];
  let prev = ya;
  for (let x = xa + 5 + rng.next() * 11; x < xb - 4; x += 5 + rng.next() * 11) {
    const t = (x - xa) / (xb - xa);
    const y = jag(prev, ya + (yb - ya) * t, rng);
    mids.push({ x, y });
    prev = y;
  }
  if (mids.length === 0) {
    mids.push({ x: (xa + xb) / 2, y: 0 });
    prev = ya;
  } else {
    prev = mids.length > 1 ? mids[mids.length - 2]!.y : ya;
  }
  // Make the last mid-point keep both of its neighbouring segments sloped.
  const last = mids[mids.length - 1]!;
  if (Math.abs(yb - last.y) < rise || Math.abs(last.y - prev) < rise || mids.length === 1) {
    for (const c of [yb + 3, yb - 3, yb + 6, yb - 6, yb + 9, yb - 9]) {
      if (c >= WORLD.minGround && c <= WORLD.maxGround && Math.abs(c - prev) >= rise && Math.abs(c - yb) >= rise) {
        last.y = c;
        break;
      }
    }
  }
  out.push(...mids);
}

export function generateTerrain(rng: Rng): Terrain {
  const W = WORLD.width;
  const mults = [...WORLD.padSet];
  for (let i = mults.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [mults[i], mults[j]] = [mults[j]!, mults[i]!];
  }
  const slot = W / mults.length;
  const margin = 12;
  const pads: Pad[] = mults.map((multiplier, i) => {
    const w = WORLD.padWidth[multiplier]!;
    const x0 = i * slot + margin + rng.next() * (slot - 2 * margin - w);
    const y = Math.round(WORLD.padMinY + rng.next() * (WORLD.padMaxY - WORLD.padMinY));
    return { x0, x1: x0 + w, y, multiplier };
  });

  const y0 = Math.round(WORLD.minGround + 20 + rng.next() * 60);
  const points: Point[] = [{ x: 0, y: y0 }];
  let cx = 0;
  let cy = y0;
  for (const p of pads) {
    fill(points, cx, cy, p.x0, p.y, rng);
    points.push({ x: p.x0, y: p.y }, { x: p.x1, y: p.y });
    cx = p.x1;
    cy = p.y;
  }
  fill(points, cx, cy, W, y0, rng);
  points.push({ x: W, y: y0 });
  return { width: W, points, pads };
}

/** Index i of the segment points[i]..points[i+1] under world x (wraps). */
export function segmentAt(t: Terrain, x: number): number {
  const wx = wrapX(x, t.width);
  const pts = t.points;
  let lo = 0;
  let hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid]!.x <= wx) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Ground height under world x (wraps). */
export function groundY(t: Terrain, x: number): number {
  const wx = wrapX(x, t.width);
  const i = segmentAt(t, wx);
  const a = t.points[i]!;
  const b = t.points[i + 1]!;
  const span = b.x - a.x;
  return span > 0 ? a.y + ((b.y - a.y) * (wx - a.x)) / span : a.y;
}

/** The pad containing world x, if any (wraps). */
export function padAt(t: Terrain, x: number): Pad | undefined {
  const wx = wrapX(x, t.width);
  return t.pads.find((p) => wx >= p.x0 && wx <= p.x1);
}
