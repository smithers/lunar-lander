# Phase 5: Vector Graphics, HUD, Controls and Main Loop

## Goal

Make the game playable in the browser: arcade-style vector rendering, the HUD, keyboard
controls with a thrust lever, and a fixed-timestep loop with a test hook Playwright can
drive.

## Work

- [ ] `src/render/vector.ts` — line drawing on black with a phosphor glow; a world→screen camera that follows the lander and zooms in at the spec's altitude.
- [ ] `src/render/font.ts` — a vector font built from line segments, for every glyph the HUD and messages use.
- [ ] `src/render/scene.ts` — lander, thrust flame scaled to thrust level, terrain, pad multiplier labels, and explosion debris.
- [ ] `src/render/hud.ts` — score, time, fuel, altitude, horizontal/vertical speed with arrows, and the landing/crash message, laid out as the spec describes.
- [ ] `src/input/keyboard.ts` — ↑/W raise and ↓/S lower the thrust lever gradually; ←/→ and A/D rotate; Space aborts; `5`/`C` inserts a coin; `1` starts; mode-select keys. No gamepad code.
- [ ] `src/main.ts` — a fixed-timestep accumulator loop (sim at a fixed rate, render on `requestAnimationFrame`), canvas resized for devicePixelRatio, and a `?test` hook exposing seed, state and scripted input on `window`.
- [ ] Write the Playwright spec for this flow: `tests/e2e/play.spec.ts` (coin → start → scripted descent lands on a pad → score shown; scripted fast descent → crash message).

## Tests

_UI and wiring: tests written alongside._

- [ ] `tests/unit/keyboard.test.ts` — lever ramp rate and clamping; key→action mapping; key repeat does not double-count.
- [ ] `tests/unit/camera.test.ts` — zoom threshold and world→screen transform.
- [ ] `tests/e2e/play.spec.ts` — the landing and crash flows above, with screenshots per viewport.

## Verification

```bash
npx vitest run tests/unit/keyboard.test.ts tests/unit/camera.test.ts
npx playwright test tests/e2e/play.spec.ts --repeat-each=3
npx tsc --noEmit
npx eslint src/render src/input src/main.ts tests
```

Play one game by hand in Safari and Chrome to check the thrust lever, rotation feel and zoom.

## Gate

- [ ] Author review completed.
- [ ] Independent review has no open blocker/major.
- [ ] Visual verification passed across the mandatory viewports (`/web-verify`: screenshots inspected for vector look, HUD legibility, pad labels and zoom).

## Evidence

- **Outcome:**
- **Changed:**
- **Verified:**
- **Deviations:**
- **Follow-ups:**
- **Artifacts:**
