import { describe, expect, it } from 'vitest';
import { Mission } from '../../src/sim/constants';
import { createLander, stepLander, type FrameInput } from '../../src/sim/lander';
import { checkContact } from '../../src/sim/landing';
import { createRng } from '../../src/sim/rng';
import { generateTerrain } from '../../src/sim/terrain';

function run(seed: number) {
  const rng = createRng(seed);
  const terrain = generateTerrain(rng);
  const s = createLander(75000);
  const inputRng = createRng(seed ^ 0x5eed);
  const trace: string[] = [];
  for (let f = 0; f < 3000; f++) {
    const r = inputRng.next();
    const input: FrameInput = {
      thrustLevel: Math.floor(r * 16),
      rotate: r < 0.2 ? 1 : r > 0.8 ? -1 : 0,
      abortHeld: f % 700 < 3,
    };
    stepLander(s, input, Mission.Command, f);
    const c = checkContact(s, terrain);
    if (f % 100 === 0 || c) trace.push(JSON.stringify(s));
    if (c) break;
  }
  return trace;
}

describe('determinism', () => {
  it('same seed and scripted inputs give identical state', () => {
    expect(run(1234)).toEqual(run(1234));
  });
  it('different seeds diverge', () => {
    expect(run(1234)).not.toEqual(run(4321));
  });
});
