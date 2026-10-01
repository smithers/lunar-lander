# Phase 2: Fidelity Spec

## Goal

Write `docs/fidelity-spec.md`: the sourced reference for every gameplay constant and rule,
so the implementation copies the 1979 Atari arcade game rather than guessing at it.

## Work

- [ ] Collect sources: the Atari *Lunar Lander* operator's/service manual, MAME driver notes for `llander`, published arcade references, and gameplay footage. List them with URLs in the spec.
- [ ] Physics: gravity, thrust acceleration range (the lever's minimum to maximum), rotation rate and angle steps, abort behavior, and the per-mode differences across Training, Cadet, Prime and Command (for example atmospheric friction, fuel use, terrain).
- [ ] Fuel: units per coin (750 is the expected value — confirm it), burn rate versus thrust level, the low-fuel warning threshold, and what happens when fuel hits zero.
- [ ] Landing: tolerances for vertical speed, horizontal speed and angle that separate each outcome (great / good / hard / crash), the points per outcome, the pad multipliers (2×–5×), fuel bonuses and penalties, and the exact message text.
- [ ] Display: HUD fields and where they sit (score, time, fuel, altitude, horizontal/vertical speed with direction arrows), the altitude at which the view zooms in, terrain scrolling or wrapping, and the attract-mode sequence.
- [ ] Sound: describe each original sound (thrust rumble, beeps, explosion, coin) so it can be synthesized.
- [ ] Mark each value **[sourced: …]** or **[estimate]**, and add a short section listing the estimates for playtest tuning.

## Tests

_Docs-only phase: no automated tests. Phase 3's tests are written from this spec._

- [ ] Every value the plan's success criteria name (gravity, thrust, rotation, fuel burn, per-mode differences, scoring table, landing tolerances, messages, coin/fuel rules, HUD layout) appears in the spec with a source tag or an estimate tag.

## Verification

```bash
grep -cE '\[(sourced|estimate)' docs/fidelity-spec.md
grep -nE 'TODO|TBD' docs/fidelity-spec.md || echo "no open placeholders"
```

Read the spec end to end against the plan's success criteria.

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
