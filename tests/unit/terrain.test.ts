import { describe, expect, it } from 'vitest';
import { WORLD } from '../../src/sim/constants';
import { createRng } from '../../src/sim/rng';
import { generateTerrain, groundY, padAt, wrapX } from '../../src/sim/terrain';

describe('terrain generation (spec §7)', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const a = generateTerrain(createRng(42));
    const b = generateTerrain(createRng(42));
    const c = generateTerrain(createRng(43));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('spans the world width and wraps (first and last heights match)', () => {
    const t = generateTerrain(createRng(1));
    expect(t.width).toBe(WORLD.width);
    expect(t.points[0]!.x).toBe(0);
    expect(t.points[t.points.length - 1]!.x).toBe(WORLD.width);
    expect(t.points[t.points.length - 1]!.y).toBe(t.points[0]!.y);
    expect(groundY(t, 0)).toBeCloseTo(groundY(t, WORLD.width), 10);
    expect(groundY(t, -5)).toBeCloseTo(groundY(t, WORLD.width - 5), 10);
  });

  it('keeps heights inside the playfield', () => {
    for (let seed = 0; seed < 20; seed++) {
      const t = generateTerrain(createRng(seed));
      for (const p of t.points) {
        expect(p.y).toBeGreaterThanOrEqual(WORLD.minGround);
        expect(p.y).toBeLessThanOrEqual(WORLD.maxGround);
      }
      for (let i = 1; i < t.points.length; i++) expect(t.points[i]!.x).toBeGreaterThan(t.points[i - 1]!.x);
    }
  });

  it('has one pad for each multiplier in the pad set, flat, with widths by multiplier', () => {
    const t = generateTerrain(createRng(7));
    expect(t.pads.map((p) => p.multiplier).sort()).toEqual([...WORLD.padSet].sort());
    for (const p of t.pads) {
      expect([2, 3, 4, 5]).toContain(p.multiplier);
      expect(p.x1 - p.x0).toBeCloseTo(WORLD.padWidth[p.multiplier]!, 6);
      expect(groundY(t, p.x0 + 0.1)).toBeCloseTo(p.y, 6);
      expect(groundY(t, p.x1 - 0.1)).toBeCloseTo(p.y, 6);
    }
    const widths = [5, 4, 3, 2].map((m) => WORLD.padWidth[m]!);
    for (let i = 1; i < widths.length; i++) expect(widths[i]!).toBeGreaterThan(widths[i - 1]!);
  });

  it('non-pad segments are never flat', () => {
    for (let seed = 0; seed < 20; seed++) {
      const t = generateTerrain(createRng(seed));
      for (let i = 1; i < t.points.length; i++) {
        const a = t.points[i - 1]!;
        const b = t.points[i]!;
        const mid = (a.x + b.x) / 2;
        if (!padAt(t, mid)) expect(Math.abs(b.y - a.y)).toBeGreaterThanOrEqual(WORLD.minSlopeRise);
      }
    }
  });

  it('padAt finds pads and respects wrap', () => {
    const t = generateTerrain(createRng(3));
    const p = t.pads[0]!;
    expect(padAt(t, (p.x0 + p.x1) / 2)).toBe(p);
    expect(padAt(t, (p.x0 + p.x1) / 2 + WORLD.width)).toBe(p);
    expect(wrapX(-1)).toBe(WORLD.width - 1);
  });
});
