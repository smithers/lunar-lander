# Phase 3: Simulation Core

## Goal

Build the deterministic, DOM-free physics and landing logic from the fidelity spec. This
phase brings Phases 1 and 2 together: the spec's values become code, and the first real
tests run on the new tooling.

## Work

- [x] `src/sim/constants.ts` — per-mode constants. A comment cites the spec section beside each one.
- [x] `src/sim/rng.ts` — a seeded PRNG, so terrain and anything else random can be reproduced.
- [x] `src/sim/lander.ts` — lander state and a fixed-timestep `step(state, input, dt)`: gravity, thrust along the heading, rotation, fuel burn proportional to thrust, abort, and per-mode friction.
- [x] `src/sim/terrain.ts` — seeded terrain generation, horizontal wrap or scroll, pads with 2×–5× multipliers, and ground-height / collision queries.
- [x] `src/sim/landing.ts` — touchdown classification (great / good / hard / crash) from the spec's thresholds, plus the score (points × multiplier, fuel bonus or penalty) and the message.
- [x] Remove the Phase 1 placeholder unit test.

## Tests

_Logic: write each failing test first, then the implementation that makes it pass._

- [x] `tests/unit/lander.test.ts` — free fall matches gravity; thrust accelerates along the heading; rotation rate and limits; fuel burn scales with thrust; no thrust at zero fuel; abort behavior; friction differs by mode.
- [x] `tests/unit/terrain.test.ts` — the same seed gives the same terrain; pads are flat and carry valid multipliers; wrap/scroll continuity; ground-height queries.
- [x] `tests/unit/landing.test.ts` — every classification boundary from the spec; score × each multiplier; landing off a pad counts as a crash; message text.
- [x] `tests/unit/determinism.test.ts` — the same seed and scripted inputs over N steps give identical state.

## Verification

```bash
npx vitest run tests/unit/lander.test.ts tests/unit/terrain.test.ts tests/unit/landing.test.ts tests/unit/determinism.test.ts
npx tsc --noEmit
npx eslint src/sim tests/unit
```

## Gate

- [x] Author review completed.
- [x] Independent review has no open blocker/major.

## Evidence

_Filled at the gate; what a human reads and what `as-built.md` is assembled from. The
independent review reads the diff, not this._

- **Outcome:** shipped — a deterministic, DOM-free simulation core that follows the spec to ROM precision, with every constant citing a spec section:
  - Thrust vector from the ROM sine table, with Prime's per-component ×1.5 boost.
  - Fuel burn factors, including the abort exception.
  - Exact Command-mode yaw and Training rotation clamp.
  - Abort procedure and Training friction.
  - Landing classification in display units, scoring and messages.
  - Seeded wrapping terrain with 8 pads (2×2×2×3×3×4×4×5).
  - Collision: hull vertices, plus terrain segments crossing the hull outline above the foot zone.
- **Changed:** `src/sim/constants.ts`, `src/sim/rng.ts`, `src/sim/lander.ts`, `src/sim/terrain.ts`, `src/sim/landing.ts` (new); `src/sim/index.ts` removed; `tests/unit/{lander,terrain,landing,determinism,rng}.test.ts` (new); `tests/unit/smoke.test.ts` removed; `docs/fidelity-spec.md` §2.4 wording.
- **Verified:** the phase's scoped vitest run passes. Full `./scripts/validate.sh` → OK, with 56 unit tests (the reconciling phase runs the full suite). `npm run build` → OK. Tests were written first and confirmed red (missing modules, then 2 failing assertions per review round) before implementation. Ran in this context, as reconciling phases are never delegated. There was nothing to merge, since Phases 1 and 2 landed in order on one branch.
- **Deviations:**
  - `createLander(fuel)` takes no mission argument, because nothing in it depends on mission.
  - Terrain is regenerated each round, which satisfies the spec's "different terrain each round".
  - Collision uses our own hull outline in screen-bytes: feet ±3, height 5.8.
- **Follow-ups:** none blocking. Independent review: rung 1 (Codex CLI, its own sign-in), 2 passes, then adjudication.
  - Pass 1: 3 major, 1 minor. Abort 100-frame cap refuted with ROM evidence (`$64AC`, `$64F7`), with spec wording clarified and a test pinning it. Narrow-peak contact and flat non-pad ×1 landing fixed. The ROM-exact fuel-used accounting fixed.
  - Pass 2: 1 major (a tall spike crossing the hull with its tip above it), adjudicated and fixed with segment intersection, plus tests for the wrap seam and a foot sunk into a pad.
- **Artifacts:** none.
