# Phase 5: Vector Graphics, HUD, Controls and Main Loop

## Goal

Make the game playable in the browser: arcade-style vector rendering, the HUD, keyboard
controls with a thrust lever, and a fixed-timestep loop with a test hook Playwright can
drive.

## Work

- [x] `src/render/vector.ts` — line drawing on black with a phosphor glow; a world→screen camera that follows the lander and zooms in at the spec's altitude.
- [x] `src/render/font.ts` — a vector font built from line segments, for every glyph the HUD and messages use.
- [x] `src/render/scene.ts` — lander, thrust flame scaled to thrust level, terrain, pad multiplier labels, and explosion debris.
- [x] `src/render/hud.ts` — score, time, fuel, altitude, horizontal/vertical speed with arrows, and the landing/crash message, laid out as the spec describes.
- [x] `src/input/keyboard.ts` — ↑/W raise and ↓/S lower the thrust lever gradually; ←/→ and A/D rotate; Space aborts; `5`/`C` inserts a coin; `1` starts; mode-select keys. No gamepad code.
- [x] `src/main.ts` — a fixed-timestep accumulator loop (sim at a fixed rate, render on `requestAnimationFrame`), canvas resized for devicePixelRatio, and a `?test` hook exposing seed, state and scripted input on `window`.
- [x] Write the Playwright spec for this flow: `tests/e2e/play.spec.ts` (coin → start → scripted descent lands on a pad → score shown; scripted fast descent → crash message).

## Tests

_UI and wiring: tests written alongside._

- [x] `tests/unit/keyboard.test.ts` — lever ramp rate and clamping; key→action mapping; key repeat does not double-count.
- [x] `tests/unit/camera.test.ts` — zoom threshold and world→screen transform.
- [x] `tests/e2e/play.spec.ts` — the landing and crash flows above, with screenshots per viewport.

## Verification

```bash
npx vitest run tests/unit/keyboard.test.ts tests/unit/camera.test.ts
npx playwright test tests/e2e/play.spec.ts --repeat-each=3
npx tsc --noEmit
npx eslint src/render src/input src/main.ts tests
```

Play one game by hand in Safari and Chrome to check the thrust lever, rotation feel and zoom.

## Gate

- [x] Author review completed.
- [x] Independent review has no open blocker/major.
- [x] Visual verification passed across the mandatory viewports (`/web-verify`: screenshots inspected for vector look, HUD legibility, pad labels and zoom).

## Evidence

_Filled at the gate; what a human reads and what `as-built.md` is assembled from. The
independent review reads the diff, not this._

- **Outcome:** shipped — the first playable build.
  - **Display:** a vector renderer on Canvas 2D: a single path per frame, a halo pass plus a bright core with shadow bloom, letterboxed to 4:3 at 1024×768.
  - **Camera:** a zoomed-out view 220 screen-bytes tall, so the HUD clears the start height, and a ×4 close-up with zoom in < 100 / out > 140 HUD altitude. Edge-band scrolling at 1/8 follows the ROM.
  - **Graphics:** our own line-segment font and LM silhouette; flame length scales with thrust; 4-piece crash debris; flashing 2X–5X pad labels.
  - **HUD:** SCORE/TIME/FUEL and ALTITUDE/HORIZONTAL SPEED/VERTICAL SPEED with arrows, plus state messages.
  - **Controls:** a keyboard lever ramp (0→15 in ≈ 0.73 s, holds when released) and the key mapping from spec §2.6, with tap capture, repeat suppression and blur release.
  - **Loop:** a fixed 40.96 Hz step with interpolated rendering, and a `?test&seed=N` hook.
- **Changed:** `src/render/{camera,font,vector,scene,hud}.ts`, `src/input/keyboard.ts` (new); `src/main.ts` (rewritten); `src/sim/game.ts` (optional `GameInput.coins`); `tests/unit/{keyboard,camera}.test.ts`, `tests/e2e/{helpers.ts,play.spec.ts}` (new); `tests/unit/game.test.ts` (+1); `eslint.config.js` (`any` allowed in e2e); `docs/fidelity-spec.md` (view headroom, zoom thresholds, lever timing).
- **Verified:** scoped vitest run (keyboard, camera) → OK. `npx playwright test tests/e2e/play.spec.ts --repeat-each=3` → 45/45 passed (5 tests × 3 viewports × 3 runs). Typecheck and lint → OK. `./scripts/validate.sh` → OK.
  - **Visual verification:** `/web-verify` on Chromium at 1280×800, 1440×900 and 1920×1080, N=3. Every capture was inspected through per-checkpoint 3×3 contact sheets (playing, landed, crashed, zoomed with thrust).
  - **Defects found in inspection and fixed:** the ship overlapped the HUD at the start (fixed with view headroom), and the lander sat under the HUD right after zoom-in (fixed with lower zoom thresholds).
  - Ran in this context.
- **Deviations:**
  - WebKit is excluded (Phase 1), so Safari is checked by hand in Phase 8.
  - Zoom thresholds and view headroom are tuned estimates, recorded in spec §7 and §12.
  - The lever timing in spec §2.6 was corrected to ≈ 0.73 s.
- **Follow-ups:** none blocking. Independent review: rung 1 (Codex CLI, its own sign-in), 2 passes.
  - Pass 1: 1 major, the camera not resetting for a new game after a round-1 game over. Fixed by detecting the lander object being replaced. The e2e test was proven red without the fix (offset 99 vs 16); its first version passed for the wrong reason, since initials entry intercepted the flow, and was corrected. 3 minors fixed: coin count per frame, blur clearing queued input, and flame/debris assertions.
  - Pass 2: no blocker or major. 1 minor fixed: the test hook repeating `coins` after the first frame.
- **Artifacts:** `test-results/` (gitignored); contact sheets in the session scratchpad `p5sheets/`, not committed.
