import { describe, expect, it } from 'vitest';
import {
  ABORT_BURN,
  GRAVITY,
  Mission,
  ROTATION_BURN,
  SINE,
  START,
  THRUST_TO_ACC,
} from '../../src/sim/constants';
import { createLander, orientation, stepLander, thrustVector, type FrameInput } from '../../src/sim/lander';

const idle: FrameInput = { thrustLevel: 0, rotate: 0, abortHeld: false };
const FULL = 1_000_000; // plenty of fuel, in hundredths

function lander(fuel = FULL) {
  return createLander(fuel);
}

describe('starting state (spec §4)', () => {
  it('matches the ROM start table', () => {
    const s = lander();
    expect(s.x).toBe(START.x);
    expect(s.y).toBe(START.y);
    expect(s.vx).toBe(0x3200);
    expect(s.vy).toBe(-0x10);
    expect(orientation(s)).toBe(16);
  });
});

describe('gravity and integration (spec §1, §4)', () => {
  it('free fall adds -gravity per frame and moves by the previous velocity', () => {
    const s = lander();
    const vy0 = s.vy;
    const y0 = s.y;
    stepLander(s, idle, Mission.Cadet, 1);
    expect(s.vy).toBe(vy0 - GRAVITY[Mission.Cadet]);
    expect(s.y).toBeCloseTo(y0 + vy0 / 65536, 10);
    expect(s.x).toBeCloseTo(START.x + 0x3200 / 65536, 10);
  });

  it('Prime has double gravity', () => {
    expect(GRAVITY[Mission.Prime]).toBe(2 * GRAVITY[Mission.Cadet]);
    const s = lander();
    stepLander(s, idle, Mission.Prime, 1);
    expect(s.vy).toBe(-0x10 - 34);
  });
});

describe('thrust vector (spec §4)', () => {
  it('upright full thrust is 27 up, 0 sideways', () => {
    expect(thrustVector(8, THRUST_TO_ACC[15]!, Mission.Cadet)).toEqual({ ax: 0, ay: 27 });
  });
  it('Prime scales each truncated component by 1.5 (27 -> 40)', () => {
    expect(thrustVector(8, THRUST_TO_ACC[15]!, Mission.Prime)).toEqual({ ax: 0, ay: 40 });
  });
  it('uses the ROM sine table and quadrant signs', () => {
    const a = THRUST_TO_ACC[15]!;
    // orientation 3: m'=3 -> ay = SINE[3], ax = SINE[5]
    expect(thrustVector(3, a, Mission.Cadet)).toEqual({
      ax: Math.floor((SINE[5]! * a) / 256),
      ay: Math.floor((SINE[3]! * a) / 256),
    });
    expect(thrustVector(16, a, Mission.Cadet)).toEqual({ ax: -27, ay: 0 });
    expect(thrustVector(0, a, Mission.Cadet)).toEqual({ ax: 27, ay: 0 });
    expect(thrustVector(24, a, Mission.Cadet)).toEqual({ ax: 0, ay: -27 });
    const q2 = thrustVector(20, a, Mission.Cadet);
    expect(q2.ax).toBeLessThan(0);
    expect(q2.ay).toBeLessThan(0);
  });
  it('thrust adds to velocity along the heading', () => {
    const s = lander();
    s.angle16 = 8 << 10; // upright
    stepLander(s, { ...idle, thrustLevel: 15 }, Mission.Cadet, 1);
    expect(s.vy).toBe(-0x10 + 27 - 17);
  });
});

describe('fuel burn (spec §5)', () => {
  it('main engine burns (acc*218)>>8 hundredths per frame', () => {
    const s = lander();
    stepLander(s, { ...idle, thrustLevel: 15 }, Mission.Cadet, 1);
    expect(FULL - s.fuel).toBe(Math.floor((28 * 218) / 256));
  });
  it('Prime uses factor 144 for normal thrust', () => {
    const s = lander();
    stepLander(s, { ...idle, thrustLevel: 15 }, Mission.Prime, 1);
    expect(FULL - s.fuel).toBe(Math.floor((28 * 144) / 256));
  });
  it('burns scale with thrust level', () => {
    const lo = lander();
    const hi = lander();
    stepLander(lo, { ...idle, thrustLevel: 4 }, Mission.Cadet, 1);
    stepLander(hi, { ...idle, thrustLevel: 12 }, Mission.Cadet, 1);
    expect(FULL - hi.fuel).toBeGreaterThan(FULL - lo.fuel);
  });
  it('rotation burns 0.06 units per frame', () => {
    const s = lander();
    stepLander(s, { ...idle, rotate: -1 }, Mission.Cadet, 1);
    expect(FULL - s.fuel).toBe(ROTATION_BURN);
  });
  it('fuel below one unit is zeroed and disables thrust and rotation', () => {
    const s = lander(120);
    const ev = stepLander(s, { ...idle, thrustLevel: 15 }, Mission.Cadet, 1);
    expect(s.fuel).toBe(0);
    expect(s.outOfFuel).toBe(true);
    expect(ev.outOfFuel).toBe(true);
    const vy = s.vy;
    const ang = s.angle16;
    stepLander(s, { thrustLevel: 15, rotate: 1, abortHeld: false }, Mission.Cadet, 2);
    expect(s.vy).toBe(vy - 17);
    expect(s.angle16).toBe(ang);
  });
  it('tracks fuel used this round', () => {
    const s = lander();
    stepLander(s, { ...idle, thrustLevel: 15 }, Mission.Cadet, 1);
    expect(s.fuelUsedRound).toBe(FULL - s.fuel);
  });
});

describe('rotation (spec §2.3, §3)', () => {
  it('easy rotation: 1 angle-high step per frame, 4 frames per orientation', () => {
    const s = lander();
    s.angle16 = 8 << 10;
    for (let f = 0; f < 4; f++) stepLander(s, { ...idle, rotate: 1 }, Mission.Cadet, f);
    expect(orientation(s)).toBe(9);
    for (let f = 0; f < 8; f++) stepLander(s, { ...idle, rotate: -1 }, Mission.Cadet, f);
    expect(orientation(s)).toBe(7);
  });
  it('Cadet allows full 360 degrees', () => {
    const s = lander();
    s.angle16 = 0;
    stepLander(s, { ...idle, rotate: -1 }, Mission.Cadet, 1);
    expect(orientation(s)).toBe(31);
  });
  it('Training clamps rotation to orientations 0..16 without burning fuel', () => {
    const s = lander();
    expect(orientation(s)).toBe(16);
    stepLander(s, { ...idle, rotate: 1 }, Mission.Training, 1);
    expect(orientation(s)).toBe(16);
    expect(s.angle16 >> 8).toBe(0x40);
    expect(s.fuel).toBe(FULL);
    s.angle16 = 0;
    stepLander(s, { ...idle, rotate: -1 }, Mission.Training, 2);
    expect(orientation(s)).toBe(0);
    expect(s.angle16 >> 8).toBe(0);
  });
  it('Command: a tap from rest leaves a persistent +80 rate', () => {
    const s = lander();
    stepLander(s, { ...idle, rotate: 1 }, Mission.Command, 1);
    expect(s.yawRate).toBe(16);
    stepLander(s, idle, Mission.Command, 2);
    expect(s.yawRate).toBe(80);
    for (let f = 3; f < 50; f++) stepLander(s, idle, Mission.Command, f);
    expect(s.yawRate).toBe(80);
  });
  it('Command: a counter-tap into the slow band stops rotation', () => {
    const s = lander();
    stepLander(s, { ...idle, rotate: 1 }, Mission.Command, 1);
    stepLander(s, idle, Mission.Command, 2); // 80, nonzero
    stepLander(s, { ...idle, rotate: -1 }, Mission.Command, 3); // 64
    expect(s.yawRate).toBe(64);
    stepLander(s, idle, Mission.Command, 4);
    expect(s.yawRate).toBe(0);
  });
  it('Command: rate clamps cycle 992 <-> 1008 and floor at -1024', () => {
    const s = lander();
    for (let f = 0; f < 80; f++) stepLander(s, { ...idle, rotate: 1 }, Mission.Command, f);
    expect([992, 1008]).toContain(s.yawRate);
    s.yawRate = 992;
    stepLander(s, { ...idle, rotate: 1 }, Mission.Command, 100);
    expect(s.yawRate).toBe(1008);
    stepLander(s, { ...idle, rotate: 1 }, Mission.Command, 101);
    expect(s.yawRate).toBe(992);
    for (let f = 0; f < 200; f++) stepLander(s, { ...idle, rotate: -1 }, Mission.Command, f);
    expect(s.yawRate).toBe(-1024);
  });
  it('Command: the angle integrates the rate', () => {
    const s = lander();
    s.yawRate = 1024;
    const a0 = s.angle16;
    stepLander(s, { ...idle, rotate: 0 }, Mission.Command, 1);
    expect(s.angle16).toBe((a0 + 1024) & 0xffff);
  });
});

describe('abort (spec §2.4)', () => {
  it('triggers on the second held frame, rights the ship, kills vx, then burns up', () => {
    const s = lander();
    let f = 0;
    stepLander(s, { ...idle, abortHeld: true }, Mission.Cadet, f++);
    expect(s.abortCounter).toBe(0);
    stepLander(s, { ...idle, abortHeld: true }, Mission.Cadet, f++);
    expect(s.abortCounter).toBe(100);
    for (let i = 0; i < 40 && orientation(s) !== 8; i++) stepLander(s, idle, Mission.Cadet, f++);
    expect(orientation(s)).toBe(8);
    const fuelBefore = s.fuel;
    stepLander(s, idle, Mission.Cadet, f++);
    expect(fuelBefore - s.fuel).toBe(ABORT_BURN);
    let frames = 0;
    while (s.abortCounter > 0 && frames < 500) {
      stepLander(s, idle, Mission.Cadet, f++);
      frames++;
    }
    expect(s.abortCounter).toBe(0);
    expect(s.vy).toBeGreaterThanOrEqual(0x1000);
    expect(Math.abs(s.vx)).toBeLessThan(256);
  });
  it('ignores rotation input during abort', () => {
    const s = lander();
    s.abortCounter = 100;
    s.angle16 = 8 << 10;
    stepLander(s, { ...idle, rotate: 1 }, Mission.Cadet, 0);
    expect(orientation(s)).toBe(8);
  });
  it('does nothing without fuel', () => {
    const s = lander(0);
    s.outOfFuel = true;
    s.abortCounter = 100;
    stepLander(s, idle, Mission.Cadet, 1);
    expect(s.abortCounter).toBe(0);
  });
  it('Prime abort still burns 2.17 units/frame', () => {
    const s = lander();
    s.angle16 = 8 << 10;
    s.abortCounter = 100;
    const before = s.fuel;
    stepLander(s, idle, Mission.Prime, 0);
    expect(before - s.fuel).toBe(ABORT_BURN);
  });
});

describe('Training friction (spec §3)', () => {
  it('removes 1/32 of each velocity component on frames where (frame & 15) == 8', () => {
    const s = lander();
    s.vx = 3200;
    s.vy = -3200;
    stepLander(s, idle, Mission.Training, 7);
    const vx = s.vx;
    expect(vx).toBe(3200);
    stepLander(s, idle, Mission.Training, 8);
    expect(s.vx).toBe(vx - (vx >> 5));
  });
  it('other missions have no friction', () => {
    const s = lander();
    stepLander(s, idle, Mission.Cadet, 8);
    expect(s.vx).toBe(0x3200);
  });
});

describe('world bounds', () => {
  it('clamps at the top of the world and zeroes upward velocity', () => {
    const s = lander();
    s.y = START.topY - 0.01;
    s.vy = 20000;
    stepLander(s, idle, Mission.Cadet, 1);
    expect(s.y).toBeLessThanOrEqual(START.topY);
    expect(s.vy).toBeLessThanOrEqual(0);
  });
});

describe('abort cap and fuel accounting (review pass 1)', () => {
  it('abort burns at most 100 upright frames even if vy stays below 4096', () => {
    const s = createLander(1_000_000);
    s.angle16 = 8 << 10;
    s.vy = -40000;
    s.abortCounter = 100;
    let burns = 0;
    for (let f = 0; f < 300 && s.abortCounter > 0; f++) {
      stepLander(s, idle, Mission.Cadet, f);
      if (s.thrust === 16) burns++;
    }
    expect(burns).toBe(100);
    expect(s.vy).toBeLessThan(0x1000);
  });
  it('fuel used counts the requested drain on the frame the tank runs dry', () => {
    const s = createLander(120);
    stepLander(s, { ...idle, thrustLevel: 15 }, Mission.Cadet, 1);
    expect(s.fuelUsedRound).toBe((28 * 218) >> 8);
  });
});
