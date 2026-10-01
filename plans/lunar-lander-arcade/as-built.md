# As-Built Spec and Drift Report — Atari 1979 Lunar Lander, Browser Recreation

_Assembled by /plan-run on 2026-10-01. Source of intent: [`plan.md`](./plan.md);
execution record: [`execution.md`](./execution.md)._

## What was built

A TypeScript + Vite browser game that recreates Atari's 1979 vector *Lunar Lander* and runs
locally with `npm run dev` (or `npm run build && npm run preview`).

**Simulation:** a deterministic, DOM-free core running at the ROM's 40.96 Hz. It follows an
annotated disassembly of the `llander` ROM to ROM precision:
- thrust vector built from the ROM's own sine table, with Prime's ×1.5 boost
- fuel burn factors, including the abort exception
- Command-mode rotational momentum, the Training rotation clamp and friction
- the abort procedure
- landing thresholds, scoring and the original message text

**Presentation:**
- glowing white vectors on black, letterboxed to 4:3
- a ×4 close-up with ROM-style edge scrolling
- our own vector font and LM silhouette
- the arcade HUD
- a keyboard thrust lever that ramps and holds its level

**Game flow:** coin-for-fuel at any time, the four missions via Select Game, and attract,
mode-select, game-over and initials screens.

**Sound:** a Web Audio recreation of the discrete sound board.

**Addition:** a local top-10 high-score table, which the original did not have.

## Per-phase outcomes

| Phase | Outcome | Deviations from plan |
|---|---|---|
| phase-01-project-setup | shipped — Vite/TS/Vitest/ESLint/Playwright scaffold and `scripts/validate.sh`. The DOM-free sim rule is enforced by type checking (`tsconfig.sim.json`) as well as lint. | WebKit is dropped from Playwright: on macOS 14 its frozen build fails with `Unknown setting: PushAPIEnabled`, so Safari moves to manual checks. There is no git remote, so commits are local only. |
| phase-02-fidelity-spec | shipped — `docs/fidelity-spec.md`, 13 sections, mostly sourced from the ROM disassembly, with 11 estimates listed in §12. | The original has no high-score table; it is kept as a documented addition. Mode select is one cycling Select Game button (Tab). Gravity is equal in Training, Cadet and Command. A 41 Hz tick. Terrain is generated, not copied from the ROM. |
| phase-03-simulation-core (brings 01–02 together) | shipped — the ROM-precise sim core: physics, rotation, abort, friction, seeded wrapping terrain with 8 pads, and hull-outline collision. | `createLander(fuel)` takes no mission. Terrain was regenerated per round (later revised in Phase 4). Our own hull outline is used for collision. |
| phase-04-game-flow | shipped — the state machine (attract → ready → playing → landed → round or game over → initials), coin-for-fuel, mission select, timers, crash fuel penalty, 5 s out-of-fuel game over, and a versioned high-score store with a memory fallback. | The sim does not import storage (an injected `qualifies` check plus a `highScore` event). Terrain is per game with a random start offset per round, matching spec §7. GAME OVER time ≈ 4 s is an estimate. |
| phase-05-vector-rendering-and-controls | shipped — the first playable build: vector renderer, camera, font, HUD, lander/flame/debris, keyboard lever, fixed-step loop and `?test` hook. | Zoom thresholds (in < 100, out > 140) and the view headroom (220 screen-bytes tall) were tuned from screenshot inspection. Lever timing was corrected to ≈ 0.73 s. Safari is still manual. |
| phase-06-sound | shipped — Web Audio sound: 12 kHz LFSR thrust rumble with the ROM volume, filters, 3 kHz low-fuel beep, 6 kHz coin chirp, noise-burst explosion, gesture unlock, mute, hidden-tab suspend. | The by-ear check was replaced by an offline-render spectrum and click test. A human by-ear check is still owed. |
| phase-07-attract-mode-and-flows | shipped — attract pages (title, high scores, controls), mode select, game over, initials entry, and Playwright flows for attract, mid-game fuel and high scores. | No demo descent, since the spec lists none. The high-score and controls pages are additions. A Ready-screen mission choice now carries into the game, and the mission resets to Training when a game ends. |
| phase-08-final-verification | partial — every machine-checkable criterion passes. Adds the README, a playability autopilot test and a performance test. | Physics estimates were not retuned without feel data. Safari, by-feel and by-ear checks are left to a person. |

## Drift report vs. plan success criteria

| Success criterion | Status | Note |
|---|---|---|
| Fidelity spec exists and is sourced | met | `docs/fidelity-spec.md`; every value is tagged sourced or estimate. |
| Unit tests pass (`npm test`) | met | 114 tests in 12 files, covering physics, burn, landing/scoring, coins, abort, missions and high scores. |
| Deterministic simulation | met | `tests/unit/determinism.test.ts`, plus game-level determinism in `game.test.ts`. |
| Type-check and build clean | met | `npm run typecheck`, which includes the DOM-less sim config, and `npm run build`. |
| Controls work as specified | met | Lever ramp and hold, ←/→ rotate, Space abort, 5/C coin, 1 start, Tab Select Game, mapping on the attract controls page, no gamepad code. |
| Coin/fuel flow | met | Attract until coin, 750 per coin, mid-game coins add fuel, game ends after running dry (5 s grace, as in the ROM). |
| Difficulty modes | met | Selectable before Start and carried into the game. The ROM differences are implemented, unit-tested and covered by the autopilot playability test. |
| Scoring and messages | met | 50/15/5 × multiplier, +50 fuel for perfect, crash fuel penalty, the ROM message text. |
| Terrain and zoom | met | Wrapping terrain, flashing 2X–5X labels, ×4 close-up. Thresholds are estimates. |
| Sound | partially met | All voices implemented and checked by event sequence and offline-render spectrum. No human has listened in Safari or Chrome yet. |
| High scores | met | Top 10 with 3 initials, survives reload, falls back to memory when storage is blocked. |
| Performance: steady 60 fps in Safari and Chrome | partially met | Chromium: median frame interval 16.70 ms, 0/230 long frames. Safari is unverified because WebKit cannot be automated here. |
| UI verified 3× across the viewport matrix, frames inspected | partially met | Chromium at 1280×800, 1440×900 and 1920×1080, N=3, 135/135 runs, every checkpoint inspected. WebKit is excluded. |
| Manual playtest by someone who knows the arcade | not met | Needs a person. An autopilot shows every mission is landable on one coin, but feel is unjudged. |

**Drift from `plan.md`'s assumptions** (plan.md itself is unedited):
- Mode selection is the original single cycling Select Game button, not a pre-start menu.
- The original had no high-score table; it is a documented addition.
- The physics tick is 40.96 Hz, with interpolated rendering.
- Playwright covers Chromium only.

## Artifacts

- Fidelity spec: `docs/fidelity-spec.md`
- Playwright captures (gitignored): `test-results/`
- Visual-inspection contact sheets (session scratchpad, not committed): `p5sheets/`, `p7sheets/`, `p8sheets/`

## Open items / follow-ups

- **Human-owed:**
  - Play in Safari and confirm a steady 60 fps.
  - Play all four missions and compare the feel with the arcade, then retune the `[estimate]` values in spec §12 if needed (altitude scale, lever ramp, zoom thresholds, terrain geometry).
  - Listen to the sound in Safari and Chrome.
- **To automate Safari later:** run `sudo safaridriver --enable` once.
- **No git remote:** all 8 phase commits are local on `feat/lunar-lander`. Add a remote and push when ready.
- **Not reproduced:** the ROM's per-round pad-set change. Pads are fixed per game and the start offset is randomized each round (spec §7).
