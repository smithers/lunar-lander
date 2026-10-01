# Phase 3: Simulation Core

## Goal

Build the deterministic, DOM-free physics and landing logic from the fidelity spec. This
phase brings Phases 1 and 2 together: the spec's values become code, and the first real
tests run on the new tooling.

## Work

- [ ] `src/sim/constants.ts` — per-mode constants. A comment cites the spec section beside each one.
- [ ] `src/sim/rng.ts` — a seeded PRNG, so terrain and anything else random can be reproduced.
- [ ] `src/sim/lander.ts` — lander state and a fixed-timestep `step(state, input, dt)`: gravity, thrust along the heading, rotation, fuel burn proportional to thrust, abort, and per-mode friction.
- [ ] `src/sim/terrain.ts` — seeded terrain generation, horizontal wrap or scroll, pads with 2×–5× multipliers, and ground-height / collision queries.
- [ ] `src/sim/landing.ts` — touchdown classification (great / good / hard / crash) from the spec's thresholds, plus the score (points × multiplier, fuel bonus or penalty) and the message.
- [ ] Remove the Phase 1 placeholder unit test.

## Tests

_Logic: write each failing test first, then the implementation that makes it pass._

- [ ] `tests/unit/lander.test.ts` — free fall matches gravity; thrust accelerates along the heading; rotation rate and limits; fuel burn scales with thrust; no thrust at zero fuel; abort behavior; friction differs by mode.
- [ ] `tests/unit/terrain.test.ts` — the same seed gives the same terrain; pads are flat and carry valid multipliers; wrap/scroll continuity; ground-height queries.
- [ ] `tests/unit/landing.test.ts` — every classification boundary from the spec; score × each multiplier; landing off a pad counts as a crash; message text.
- [ ] `tests/unit/determinism.test.ts` — the same seed and scripted inputs over N steps give identical state.

## Verification

```bash
npx vitest run tests/unit/lander.test.ts tests/unit/terrain.test.ts tests/unit/landing.test.ts tests/unit/determinism.test.ts
npx tsc --noEmit
npx eslint src/sim tests/unit
```

## Gate

- [ ] Author review completed.
- [ ] Independent review has no open blocker/major.

## Evidence

- **Outcome:**
- **Changed:**
- **Verified:**
- **Deviations:**
- **Follow-ups:**
- **Artifacts:**
