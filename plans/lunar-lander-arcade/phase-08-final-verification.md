# Phase 8: Final Verification and Playtest

## Goal

Prove every success criterion in `plan.md` holds for the integrated game, and tune any
spec estimates through playtesting.

## Work

- [ ] Go through each success criterion in `plan.md` and record its evidence (command output, screenshot path or playtest note) in this phase's Evidence.
- [ ] Profile for performance in Safari and Chrome on Apple Silicon: a steady 60 fps, including during zoom transitions and explosions. Fix any hot spots found.
- [ ] Playtest each mode (Training, Cadet, Prime, Command). Tune constants marked **[estimate]** in `docs/fidelity-spec.md`, updating the spec and `src/sim/constants.ts` together.
- [ ] Add a `README.md` covering how to run (`npm install`, `npm run dev` / `npm run build && npm run preview`), the controls, and the modes.

## Tests

- [ ] Any constant tuned during playtest has its unit-test expectations updated to the new spec value, and the tests pass.

## Verification

Full suite, since this is the final verification-gate phase:

```bash
./scripts/validate.sh
npm run build
npx playwright test --repeat-each=3
```

Run a manual playtest of all four modes. Check that no gamepad code exists:

```bash
grep -rn getGamepads src || echo "no gamepad code"
```

## Gate

- [ ] Author review completed.
- [ ] Independent review has no open blocker/major.
- [ ] Visual verification passed across the mandatory viewports (`/web-verify` across all e2e flows, frames inspected).

## Evidence

- **Outcome:**
- **Changed:**
- **Verified:**
- **Deviations:**
- **Follow-ups:**
- **Artifacts:**
