import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim/rng';

describe('rng', () => {
  it('is reproducible and in [0,1)', () => {
    const a = createRng(9);
    const b = createRng(9);
    for (let i = 0; i < 1000; i++) {
      const x = a.next();
      expect(x).toBe(b.next());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it('int(n) stays in range and state can be saved and restored', () => {
    const a = createRng(5);
    for (let i = 0; i < 100; i++) {
      const v = a.int(4);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(4);
    }
    const saved = a.state;
    const x = a.next();
    const b = createRng(0);
    b.state = saved;
    expect(b.next()).toBe(x);
  });
});
