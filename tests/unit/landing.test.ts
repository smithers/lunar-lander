import { describe, expect, it } from 'vitest';
import { MESSAGES, POINTS, PERFECT_FUEL_BONUS } from '../../src/sim/constants';
import { createLander } from '../../src/sim/lander';
import { checkContact, classifyTouchdown, landingMessage, scoreFor, Outcome } from '../../src/sim/landing';
import type { Terrain } from '../../src/sim/terrain';
import { createRng } from '../../src/sim/rng';

// A hand-built terrain: one 5x pad at y=40 from x=100..108, slopes elsewhere.
const terrain: Terrain = {
  width: 1024,
  points: [
    { x: 0, y: 60 },
    { x: 100, y: 40 },
    { x: 108, y: 40 },
    { x: 200, y: 80 },
    { x: 1024, y: 60 },
  ],
  pads: [{ x0: 100, x1: 108, y: 40, multiplier: 5 }],
};

describe('classifyTouchdown (spec §6)', () => {
  const v = (disp: number) => disp * 64;
  it('good: upright-ish, |vy|<16, |vx|<16 disp', () => {
    for (const o of [7, 8, 9]) expect(classifyTouchdown(o, v(15), v(15) + 63, true)).toBe(Outcome.Good);
  });
  it('hard: |vy| 16..31', () => {
    expect(classifyTouchdown(8, 0, v(16), true)).toBe(Outcome.Hard);
    expect(classifyTouchdown(8, 0, v(31) + 63, true)).toBe(Outcome.Hard);
  });
  it('crash: |vy| >= 32, |vx| >= 16, tilted, or not on flat ground', () => {
    expect(classifyTouchdown(8, 0, v(32), true)).toBe(Outcome.Crash);
    expect(classifyTouchdown(8, v(16), 0, true)).toBe(Outcome.Crash);
    expect(classifyTouchdown(6, 0, 0, true)).toBe(Outcome.Crash);
    expect(classifyTouchdown(10, 0, 0, true)).toBe(Outcome.Crash);
    expect(classifyTouchdown(8, 0, 0, false)).toBe(Outcome.Crash);
  });
});

describe('scoreFor (spec §6)', () => {
  it('awards points x multiplier', () => {
    for (const m of [1, 2, 3, 4, 5]) {
      expect(scoreFor(Outcome.Good, m)).toBe(50 * m);
      expect(scoreFor(Outcome.Hard, m)).toBe(15 * m);
      expect(scoreFor(Outcome.Crash, m)).toBe(5 * m);
    }
    expect(POINTS[Outcome.Good]).toBe(50);
    expect(PERFECT_FUEL_BONUS).toBe(5000);
  });
});

describe('checkContact', () => {
  function shipAt(x: number, y: number, vx = 0, vy = -200) {
    const s = createLander(10000);
    s.x = x;
    s.y = y;
    s.vx = vx;
    s.vy = vy;
    s.angle16 = 8 << 10;
    return s;
  }
  it('no contact while clear of the ground', () => {
    expect(checkContact(shipAt(104, 45), terrain)).toBeNull();
  });
  it('a soft upright touchdown on the pad is a good 5x landing', () => {
    const c = checkContact(shipAt(104, 40.3), terrain);
    expect(c).not.toBeNull();
    expect(c!.outcome).toBe(Outcome.Good);
    expect(c!.multiplier).toBe(5);
  });
  it('a foot hanging off the pad edge is a crash', () => {
    const c = checkContact(shipAt(101, 40.3), terrain);
    expect(c!.outcome).toBe(Outcome.Crash);
  });
  it('touching a slope is a crash with multiplier 1', () => {
    const x = 150;
    const gy = 40 + ((x - 108) * 40) / 92;
    const c = checkContact(shipAt(x, gy + 0.2), terrain);
    expect(c!.outcome).toBe(Outcome.Crash);
    expect(c!.multiplier).toBe(1);
  });
  it('a fast touchdown on the pad crashes but keeps the pad multiplier for the 5 points', () => {
    const c = checkContact(shipAt(104, 40.3, 0, -32 * 64), terrain);
    expect(c!.outcome).toBe(Outcome.Crash);
    expect(c!.multiplier).toBe(5);
  });
  it('a sideways ship body hitting the pad is a crash', () => {
    const s = shipAt(104, 42);
    s.angle16 = 16 << 10;
    expect(checkContact(s, terrain)!.outcome).toBe(Outcome.Crash);
  });
});

describe('landingMessage', () => {
  it('picks the documented lines', () => {
    const rng = createRng(1);
    for (let i = 0; i < 20; i++) {
      const g = landingMessage(Outcome.Good, rng);
      expect(g[0]).toBe('CONGRATULATIONS');
      expect(MESSAGES.good).toContain(g[1]);
      const h = landingMessage(Outcome.Hard, rng);
      expect(h[0]).toBe('YOU LANDED HARD');
      expect(MESSAGES.hard).toContain(h[1]);
      const c = landingMessage(Outcome.Crash, rng);
      expect(MESSAGES.crash).toContain(c[0]);
    }
  });
});

describe('contact robustness (review pass 1)', () => {
  function upright(x: number, y: number) {
    const s = createLander(10000);
    s.x = x;
    s.y = y;
    s.vx = 0;
    s.vy = -200;
    s.angle16 = 8 << 10;
    return s;
  }
  it('detects a narrow peak poking up between the feet into the body', () => {
    const spike: Terrain = {
      width: 1024,
      points: [
        { x: 0, y: 20 },
        { x: 103.5, y: 20 },
        { x: 104, y: 44 },
        { x: 104.5, y: 20 },
        { x: 1024, y: 20 },
      ],
      pads: [],
    };
    const c = checkContact(upright(104, 40), spike);
    expect(c).not.toBeNull();
    expect(c!.outcome).toBe(Outcome.Crash);
  });
  it('a soft landing on flat ground that is not a pad scores x1', () => {
    const flat: Terrain = {
      width: 1024,
      points: [
        { x: 0, y: 40 },
        { x: 1024, y: 40 },
      ],
      pads: [],
    };
    const c = checkContact(upright(500, 40.3), flat);
    expect(c!.outcome).toBe(Outcome.Good);
    expect(c!.multiplier).toBe(1);
    expect(c!.points).toBe(50);
  });
  it('does not count pad-edge vertices below the feet as body contact', () => {
    const c = checkContact(upright(103.5, 40.3), terrain);
    expect(c!.outcome).toBe(Outcome.Good);
  });
});

describe('contact robustness (review pass 2)', () => {
  it('detects a tall spike passing through the hull with its tip above the ship', () => {
    const tall: Terrain = {
      width: 1024,
      points: [
        { x: 0, y: 20 },
        { x: 104.25, y: 20 },
        { x: 104.5, y: 47 },
        { x: 104.75, y: 20 },
        { x: 1024, y: 20 },
      ],
      pads: [],
    };
    const s = createLander(10000);
    s.x = 104;
    s.y = 40;
    s.vx = 0;
    s.vy = -200;
    s.angle16 = 8 << 10;
    const c = checkContact(s, tall);
    expect(c).not.toBeNull();
    expect(c!.outcome).toBe(Outcome.Crash);
  });
  it('feet sunk slightly into the pad are still a landing, not a body hit', () => {
    const s = createLander(10000);
    s.x = 104;
    s.y = 39.8;
    s.vx = 0;
    s.vy = -200;
    s.angle16 = 8 << 10;
    expect(checkContact(s, terrain)!.outcome).toBe(Outcome.Good);
  });
  it('works across the world wrap seam', () => {
    const seam: Terrain = {
      width: 1024,
      points: [
        { x: 0, y: 20 },
        { x: 0.5, y: 47 },
        { x: 1, y: 20 },
        { x: 1024, y: 20 },
      ],
      pads: [],
    };
    const s = createLander(10000);
    s.x = 1023.6;
    s.y = 40;
    s.vy = -200;
    s.angle16 = 8 << 10;
    expect(checkContact(s, seam)).not.toBeNull();
  });
});
