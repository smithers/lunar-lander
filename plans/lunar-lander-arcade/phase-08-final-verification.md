# Phase 8: Final Verification and Playtest

## Goal

Prove every success criterion in `plan.md` holds for the integrated game, and tune any
spec estimates through playtesting.

## Work

- [x] Go through each success criterion in `plan.md` and record its evidence (command output, screenshot path or playtest note) in this phase's Evidence.
- [x] Profile for performance in Safari and Chrome on Apple Silicon: a steady 60 fps, including during zoom transitions and explosions. Fix any hot spots found. _Chrome: done by `tests/e2e/perf.spec.ts`, with no hot spots found. Safari: **skipped, owed by a person.** WebKit cannot be automated on this macOS 14 machine (Phase 1), and `safaridriver` needs a one-time `sudo safaridriver --enable`. Recorded in Follow-ups._
- [x] Playtest each mode (Training, Cadet, Prime, Command). Tune constants marked **[estimate]** in `docs/fidelity-spec.md`, updating the spec and `src/sim/constants.ts` together. _Automated playtest: `tests/unit/playability.test.ts` lands every mode with an autopilot on one coin. Earlier phases already tuned the view-only estimates (view headroom and zoom thresholds, §7) from screenshot inspection. **The by-feel playtest by someone who knows the arcade game is skipped and owed by a person.** No physics estimate was retuned without that feel data. Recorded in Follow-ups._
- [x] Add a `README.md` covering how to run (`npm install`, `npm run dev` / `npm run build && npm run preview`), the controls, and the modes.

## Tests

- [x] Any constant tuned during playtest has its unit-test expectations updated to the new spec value, and the tests pass. _No sim constant was retuned in this phase (see Work). `tests/unit/playability.test.ts` was added and passes._

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

- [x] Author review completed.
- [x] Independent review has no open blocker/major.
- [x] Visual verification passed across the mandatory viewports (`/web-verify` across all e2e flows, frames inspected).

## Evidence

_Filled at the gate; what a human reads and what `as-built.md` is assembled from. The
independent review reads the diff, not this._

- **Outcome:** partial. Every machine-checkable success criterion passes. Two plan criteria need a person and are not claimed: Safari performance, and a by-feel playtest by someone who knows the arcade game. A by-ear sound check (Phase 6) is also outstanding. The phase added `README.md`, an automated playability test across all four missions, and a performance test.
- **Changed:** `README.md`, `tests/unit/playability.test.ts`, `tests/e2e/perf.spec.ts` (new).
- **Verified:** run once, at the same tree content as this phase's commit.
  - `./scripts/validate.sh` → OK, 114 unit tests in 12 files. `npm run build` → OK.
  - `npx playwright test --repeat-each=3` → 135/135 (15 tests × Chromium at 3 viewports × 3 runs).
  - `grep -rn getGamepads src` → no gamepad code.
  - **Playability (autopilot from the start height, over a pad):** Training lands Good in 62.5 s using 202 units, Cadet in 59.4 s using 349, Prime in 71.3 s using 371, Command in 59.4 s using 349. All are inside one 750-unit coin. Braking the starting 200-disp drift costs 50–200 units.
  - **Performance (Chromium):** the rAF frame interval median is 16.70 ms with 0 long frames out of 230 at every viewport. `render()` submission p95 is ≤ 0.3 ms in flight, close-up and crash scenes. It excludes rasterization, so the frame interval is the meaningful number.
  - **Visual verification:** `/web-verify` across all e2e flows (Chromium × 3 viewports, N=3). All 11 checkpoints × 9 captures were inspected through contact sheets: playing, landed, crashed, close-up with thrust, three attract pages, Ready, initials, table after reload, and the mid-game coin.
  - Ran in this context.
- **Success criteria (plan.md):**
  - **Fidelity spec sourced:** pass. `docs/fidelity-spec.md` has every value tagged sourced or estimate, with remaining estimates in §12.
  - **Unit tests pass:** pass, 114.
  - **Deterministic simulation:** pass (`tests/unit/determinism.test.ts`, plus game-level determinism).
  - **Type-check and build:** pass.
  - **Controls:** pass. Lever ramp, ←/→, Space abort, 5/C coin, 1 start, Tab select, mapping shown on the attract controls page, no gamepad code.
  - **Coin/fuel flow:** pass. 750 per coin, mid-game coins add fuel, game over 5 s after running dry (`fuel.spec`, `game.test`).
  - **Difficulty modes:** pass. All four are selectable before Start, carry into the game, and differ as the spec says (`lander.test`, `playability.test`).
  - **Scoring and messages:** pass (`landing.test`, `play.spec`).
  - **Terrain and zoom:** pass. Wrapping terrain, flashing 2X–5X labels, ×4 close-up (`camera.test`, `play.spec`).
  - **Sound:** pass by automated checks (event sequence, and offline-render spectrum with no clipping or clicks). By-ear check not done.
  - **High scores:** pass. Top 10, 3 initials, survives reload, blocked storage falls back to memory (`highscore.spec`).
  - **Performance:** partial. 60 fps verified in Chromium only; Safari is owed.
  - **UI verified 3× across the viewport matrix:** pass for Chromium. WebKit is excluded (Phase 1).
  - **Manual playtest:** not done; owed by a person.
- **Deviations:** physics estimates were not retuned without feel data. Safari and the by-feel and by-ear checks were left to a human rather than claimed.
- **Follow-ups:**
  - **Human-owed:** Safari playthrough and 60 fps check; by-feel playtest of all four missions against the arcade, then retune the §12 estimates if needed; by-ear sound check in Safari and Chrome.
  - To automate Safari later, run `sudo safaridriver --enable` once.
  - Independent review: rung 1 (Codex CLI, its own sign-in), 2 passes. Pass 1 found 2 majors (the perf zoom scene was never zoomed; the frame-rate floor was missing) and 1 minor (README scoring conditions), all fixed. Pass 2 was clean.
- **Artifacts:** `test-results/` (gitignored); contact sheets in the session scratchpad `p8sheets/`, not committed.
