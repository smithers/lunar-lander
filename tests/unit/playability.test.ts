// Automated playtest: a simple autopilot can make a good landing in every mission on one
// coin of fuel. Guards the physics constants against changes that would make a mode
// unplayable (e.g. Prime's thrust/weight is only ~1.18).
import { describe, expect, it } from 'vitest';
import {
  FRAME_HZ,
  FUEL_PER_COIN,
  GRAVITY,
  Mission,
  MISSION_NAMES,
  RAW_PER_SB,
  START,
  THRUST_TO_ACC,
} from '../../src/sim/constants';
import { createLander, stepLander, thrustVector } from '../../src/sim/lander';
import { checkContact, Outcome } from '../../src/sim/landing';
import type { Terrain } from '../../src/sim/terrain';

const pad: Terrain = {
  width: 1024,
  points: [
    { x: 0, y: 30 },
    { x: 490, y: 20 },
    { x: 515, y: 20 },
    { x: 1024, y: 30 },
  ],
  pads: [{ x0: 490, x1: 515, y: 20, multiplier: 2 }],
};

/**
 * Descend from the start height straight over a pad. The target speed is a braking-distance
 * profile: 60% of the speed that full thrust can still cancel before the ground (v² = 2·a·d),
 * floored at a gentle 1.5 disp for the touchdown.
 */
function autoland(mission: Mission) {
  const s = createLander(FUEL_PER_COIN);
  s.x = 502.5;
  s.vx = 0;
  s.angle16 = 8 << 10;
  const net = thrustVector(8, THRUST_TO_ACC[15]!, mission).ay - GRAVITY[mission];
  for (let f = 0; f < 20000; f++) {
    const alt = s.y - 20;
    const target = -Math.max(96, 0.6 * Math.sqrt(2 * net * Math.max(0, alt) * RAW_PER_SB));
    stepLander(s, { thrustLevel: s.vy < target ? 15 : 0, rotate: 0, abortHeld: false }, mission, f);
    const c = checkContact(s, pad);
    if (c) return { outcome: c.outcome, fuelUsed: (FUEL_PER_COIN - s.fuel) / 100, seconds: f / FRAME_HZ };
  }
  return { outcome: 'none', fuelUsed: 0, seconds: Infinity };
}

describe('playability', () => {
  for (const m of [Mission.Training, Mission.Cadet, Mission.Prime, Mission.Command]) {
    it(`${MISSION_NAMES[m]}: an autopilot lands well from the start height on one coin`, () => {
      const r = autoland(m);
      expect(r.outcome).toBe(Outcome.Good);
      expect(r.fuelUsed).toBeLessThan(750);
      expect(r.seconds).toBeLessThan(120);
    });
  }
  it('braking the starting drift (200 disp) costs a modest share of one coin', () => {
    const s = createLander(FUEL_PER_COIN);
    expect(s.angle16 >> 10).toBe(START.orientation); // thrust points left: burning brakes
    let f = 0;
    while (s.vx > 0 && f < 5000) stepLander(s, { thrustLevel: 15, rotate: 0, abortHeld: false }, Mission.Cadet, f++);
    const used = (FUEL_PER_COIN - s.fuel) / 100;
    expect(used).toBeGreaterThan(50);
    expect(used).toBeLessThan(200);
  });
});
