// Touchdown detection, classification and scoring (spec §6).
import { CONTACT_DIST, GOOD_MAX_V, HARD_MAX_VY, MESSAGES, POINTS, RAW_PER_DISP, UPRIGHT } from './constants';
import { orientation, type LanderState } from './lander';
import type { Rng } from './rng';
import { groundY, padAt, segmentAt, wrapX, type Terrain } from './terrain';

export const Outcome = { Good: 'good', Hard: 'hard', Crash: 'crash' } as const;
export type Outcome = (typeof Outcome)[keyof typeof Outcome];

/** Lander hull in screen-bytes, upright, origin at the bottom centre between the feet. */
export const FEET = [
  { x: -3, y: 0 },
  { x: 3, y: 0 },
] as const;
export const BODY = [
  { x: -2.2, y: 1.5 },
  { x: 2.2, y: 1.5 },
  { x: -2, y: 3 },
  { x: 2, y: 3 },
  { x: -1.3, y: 5.2 },
  { x: 1.3, y: 5.2 },
  { x: 0, y: 5.8 },
] as const;

/**
 * Hull outline (upright, counter-clockwise from the left foot). The notch between the feet,
 * below the descent stage, is outside the hull.
 */
export const OUTLINE = [
  { x: -3, y: 0 },
  { x: -2.2, y: 1.5 },
  { x: 2.2, y: 1.5 },
  { x: 3, y: 0 },
  { x: 2, y: 3 },
  { x: 1.3, y: 5.2 },
  { x: 0, y: 5.8 },
  { x: -1.3, y: 5.2 },
  { x: -2, y: 3 },
] as const;

export interface Contact {
  outcome: Outcome;
  multiplier: number;
  points: number;
  vxDisp: number;
  vyDisp: number;
}

export const disp = (raw: number) => Math.floor(Math.abs(raw) / RAW_PER_DISP);

/** Rotate a hull point by the ship's orientation (8 = upright) and place it in the world. */
export function hullPoint(s: LanderState, p: { x: number; y: number }): { x: number; y: number } {
  const phi = ((orientation(s) - 8) * Math.PI) / 16;
  const c = Math.cos(phi);
  const sn = Math.sin(phi);
  return { x: s.x + p.x * c - p.y * sn, y: s.y + p.x * sn + p.y * c };
}

export function classifyTouchdown(o: number, vxRaw: number, vyRaw: number, onFlat: boolean): Outcome {
  const vx = disp(vxRaw);
  const vy = disp(vyRaw);
  if (!onFlat || !(UPRIGHT as readonly number[]).includes(o) || vx >= GOOD_MAX_V || vy >= HARD_MAX_VY) {
    return Outcome.Crash;
  }
  return vy < GOOD_MAX_V ? Outcome.Good : Outcome.Hard;
}

export function scoreFor(outcome: Outcome, multiplier: number): number {
  return POINTS[outcome] * multiplier;
}

/** Intersection point of segments p1-p2 and q1-q2, or null. */
function intersect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  q1: { x: number; y: number },
  q2: { x: number; y: number },
): { x: number; y: number } | null {
  const rx = p2.x - p1.x;
  const ry = p2.y - p1.y;
  const sx = q2.x - q1.x;
  const sy = q2.y - q1.y;
  const den = rx * sy - ry * sx;
  if (den === 0) return null;
  const t = ((q1.x - p1.x) * sy - (q1.y - p1.y) * sx) / den;
  const u = ((q1.x - p1.x) * ry - (q1.y - p1.y) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: p1.x + t * rx, y: p1.y + t * ry } : null;
}

/** Hull crossings below this local height are the feet settling, not the body hitting. */
const FOOT_ZONE = 1;

/** True if any terrain segment crosses the hull outline above the foot zone. */
function terrainCrossesBody(s: LanderState, t: Terrain): boolean {
  const poly = OUTLINE.map((p) => hullPoint(s, p));
  const xs = poly.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const phi = ((orientation(s) - 8) * Math.PI) / 16;
  const localY = (p: { x: number; y: number }) => -(p.x - s.x) * Math.sin(phi) + (p.y - s.y) * Math.cos(phi);
  const half = t.width / 2;
  const pts = t.points;
  for (let i = 0; i < pts.length - 1; i++) {
    // Unwrap the segment to the copy nearest the ship.
    const shift = s.x - (wrapX(s.x - pts[i]!.x + half, t.width) - half) - pts[i]!.x;
    const a = { x: pts[i]!.x + shift, y: pts[i]!.y };
    const b = { x: pts[i + 1]!.x + shift, y: pts[i + 1]!.y };
    if (b.x < minX || a.x > maxX) continue;
    for (let k = 0; k < poly.length; k++) {
      const hit = intersect(poly[k]!, poly[(k + 1) % poly.length]!, a, b);
      if (hit && localY(hit) >= FOOT_ZONE) return true;
    }
  }
  return false;
}

/** True if both feet stand on the same flat terrain segment. */
function onFlatSegment(t: Terrain, xl: number, xr: number): boolean {
  const i = segmentAt(t, xl);
  if (segmentAt(t, xr) !== i) return false;
  return t.points[i]!.y === t.points[i + 1]!.y;
}

/** Returns the touchdown result once the hull touches the ground (within contact distance). */
export function checkContact(s: LanderState, t: Terrain): Contact | null {
  const feet = FEET.map((p) => hullPoint(s, p));
  const body = BODY.map((p) => hullPoint(s, p));
  const h = (p: { x: number; y: number }) => p.y - groundY(t, p.x);
  const feetTouch = feet.some((p) => h(p) < CONTACT_DIST);
  const bodyTouch = body.some((p) => h(p) < CONTACT_DIST) || terrainCrossesBody(s, t);
  if (!feetTouch && !bodyTouch) return null;

  const onFlat = !bodyTouch && onFlatSegment(t, feet[0]!.x, feet[1]!.x);
  const outcome = classifyTouchdown(orientation(s), s.vx, s.vy, onFlat);
  const multiplier = padAt(t, s.x)?.multiplier ?? 1;
  return { outcome, multiplier, points: scoreFor(outcome, multiplier), vxDisp: disp(s.vx), vyDisp: disp(s.vy) };
}

/** The message lines for an outcome; one of four variants chosen at random (§6.1). */
export function landingMessage(outcome: Outcome, rng: Rng): string[] {
  const pick = (list: readonly string[]) => list[rng.int(list.length)]!;
  if (outcome === Outcome.Good) return ['CONGRATULATIONS', pick(MESSAGES.good)];
  if (outcome === Outcome.Hard) return ['YOU LANDED HARD', pick(MESSAGES.hard)];
  return [pick(MESSAGES.crash)];
}
