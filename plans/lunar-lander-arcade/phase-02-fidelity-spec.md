# Phase 2: Fidelity Spec

## Goal

Write `docs/fidelity-spec.md`: the sourced reference for every gameplay constant and rule,
so the implementation copies the 1979 Atari arcade game rather than guessing at it.

## Work

- [x] Collect sources: the Atari *Lunar Lander* operator's/service manual, MAME driver notes for `llander`, published arcade references, and gameplay footage. List them with URLs in the spec.
- [x] Physics: gravity, thrust acceleration range (the lever's minimum to maximum), rotation rate and angle steps, abort behavior, and the per-mode differences across Training, Cadet, Prime and Command (for example atmospheric friction, fuel use, terrain).
- [x] Fuel: units per coin (750 is the expected value — confirm it), burn rate versus thrust level, the low-fuel warning threshold, and what happens when fuel hits zero.
- [x] Landing: tolerances for vertical speed, horizontal speed and angle that separate each outcome (great / good / hard / crash), the points per outcome, the pad multipliers (2×–5×), fuel bonuses and penalties, and the exact message text.
- [x] Display: HUD fields and where they sit (score, time, fuel, altitude, horizontal/vertical speed with direction arrows), the altitude at which the view zooms in, terrain scrolling or wrapping, and the attract-mode sequence.
- [x] Sound: describe each original sound (thrust rumble, beeps, explosion, coin) so it can be synthesized.
- [x] Mark each value **[sourced: …]** or **[estimate]**, and add a short section listing the estimates for playtest tuning.

## Tests

_Docs-only phase: no automated tests. Phase 3's tests are written from this spec._

- [x] Every value the plan's success criteria name (gravity, thrust, rotation, fuel burn, per-mode differences, scoring table, landing tolerances, messages, coin/fuel rules, HUD layout) appears in the spec with a source tag or an estimate tag.

## Verification

```bash
grep -cE '\[(sourced|estimate)' docs/fidelity-spec.md
grep -nE 'TODO|TBD' docs/fidelity-spec.md || echo "no open placeholders"
```

Read the spec end to end against the plan's success criteria.

## Gate

- [x] Author review completed.
- [x] Independent review has no open blocker/major.

## Evidence

_Filled at the gate; what a human reads and what `as-built.md` is assembled from. The
independent review reads the diff, not this._

- **Outcome:** shipped — `docs/fidelity-spec.md`, a 13-section sourced reference. Most physics, rotation, fuel, scoring and message rules are taken directly from an annotated disassembly of the rev-2 `llander` ROM, with addresses cited. 11 values remain estimates (altitude scale, zoom thresholds, terrain geometry and similar), listed in §12 for playtest.
- **Changed:** `docs/fidelity-spec.md` (new).
- **Verified:** 71 `[sourced|estimate]` tags; no TODO/TBD; doc read end to end against the plan's success criteria. Every listed category is covered. Research ran in a read-only in-process sub-agent; the spec was written in this context.
- **Deviations:** findings that change `plan.md`'s assumptions, which stays unedited as a stable reference:
  - **The original has no high-score table.** It is kept as a documented `[addition]` because the user asked for it.
  - **Mode selection is one cycling "Select Game" button** (key `Tab`), not a pre-start menu. It works mid-flight, and every game starts in Training.
  - **Gravity is the same in Training, Cadet and Command.** Training differs by friction and a rotation limit; Prime has double gravity and ×1.5 thrust.
  - **The game runs at a 41 Hz physics tick.** The sim uses a 40.96 Hz fixed step with interpolated rendering.
  - **No ROM terrain is copied.** Terrain is generated from a seed.
- **Follow-ups:** none blocking. Independent review: rung 1 (Codex CLI, its own sign-in), 2 passes, then adjudication.
  - Pass 1: 3 major (Command yaw stop rule, `Math.sin` substitution, Prime abort burn factor) and 2 minor (initial vy, rev-2 fuel options). All fixed.
  - Pass 2: 1 major (Prime ×1.5 applied after per-component truncation) and 1 minor (yaw clamp cycle 992↔1008). Fixed after confirming in the ROM at `$6CC7–$6CD7` and `$638E–$63A2`.
- **Artifacts:** research downloads (disassembly, MAME driver) in the session scratchpad, not committed.
