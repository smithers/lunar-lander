# Phase 7: Attract Mode, Initials Entry and Full Playwright Flows

## Goal

Finish the arcade wrapper around play (the attract loop, the high-score table and
3-letter initials entry) and cover every main flow end to end.

## Work

- [x] Attract-mode screens in `src/render/` following the spec's sequence: title, "INSERT COIN", key mapping, the high-score table, and a demo descent if the spec includes one.
- [x] Mode-select screen after a coin, and the game-over screen.
- [x] Arcade-style initials entry (cycle letters with ←/→, confirm with Space or Enter), saved through `src/storage/highscores.ts`.
- [x] Write/extend the Playwright specs that drive these flows: `tests/e2e/attract.spec.ts`, `tests/e2e/fuel.spec.ts`, `tests/e2e/highscore.spec.ts`.

## Tests

_UI and wiring: tests written alongside._

- [x] `tests/e2e/attract.spec.ts` — the attract loop cycles through its screens; the key mapping and high-score table are visible; a coin leaves attract mode.
- [x] `tests/e2e/fuel.spec.ts` — a mid-game coin raises the HUD fuel by the spec amount.
- [x] `tests/e2e/highscore.spec.ts` — a qualifying game → initials entry → reload → the entry is still in the table; with storage blocked, the game still runs.

## Verification

```bash
npx playwright test tests/e2e/attract.spec.ts tests/e2e/fuel.spec.ts tests/e2e/highscore.spec.ts --repeat-each=3
npx tsc --noEmit
npx eslint src tests/e2e
```

## Gate

- [x] Author review completed.
- [x] Independent review has no open blocker/major.
- [x] Visual verification passed across the mandatory viewports (`/web-verify`: attract screens, initials entry and high-score table inspected).

## Evidence

_Filled at the gate; what a human reads and what `as-built.md` is assembled from. The
independent review reads the diff, not this._

- **Outcome:** shipped — `src/render/screens.ts`.
  - **Attract:** cycles title, high scores and controls every 246 frames (≈ 6 s), with a flashing INSERT COINS and "750 FUEL UNITS PER COIN". Terrain drifts behind the title page.
  - **Ready (mode select):** SELECT OPTION / PUSH START, fuel units, the mission list with the selection bracketed, and key hints.
  - **Game over:** GAME OVER and the final score.
  - **Initials entry:** GREAT SCORE, three letters with a flashing cursor, and hints.
  - **Layout:** text never overlaps the mountains. Text-heavy screens drop the terrain; the others keep their text above the highest possible peak.
  - **Fixes:** a mission chosen after coin-up now carries into the game, and the mission resets to Training when a game ends. Arrow taps shorter than a frame now count, which initials entry needs.
- **Changed:** `src/render/screens.ts` (new); `src/render/hud.ts` (in-flight messages only); `src/main.ts` (screens, attract drift, `showTerrain`, snapshot fields); `src/input/keyboard.ts` (rotation taps); `src/sim/game.ts` (mission reset moved to game end); `docs/fidelity-spec.md` §2.5; `tests/unit/{screens}.test.ts` (new), `tests/unit/{keyboard,game}.test.ts` (+3); `tests/e2e/{attract,fuel,highscore}.spec.ts` (new), `tests/e2e/helpers.ts`.
- **Verified:**
  - `npx playwright test tests/e2e/attract.spec.ts tests/e2e/fuel.spec.ts tests/e2e/highscore.spec.ts --repeat-each=3` → 36/36. Play and sound specs → 24/24. Typecheck and lint → OK. `./scripts/validate.sh` → OK (109 unit tests).
  - **Visual verification:** `/web-verify` on Chromium at 1280×800, 1440×900 and 1920×1080, N=3. Every capture was inspected through contact sheets: the three attract pages, Ready, initials, the table after reload, and the fuel HUD before and after a coin.
  - **Inspection defect found and fixed:** text was drawn over the terrain on the attract, Ready and initials screens. It is now guarded by zero-pixel band assertions.
  - The screen assertions were proven red with `drawScreens` disabled.
  - Ran in this context.
- **Deviations:** no demo descent in attract, because spec §9 lists none. The high-score and controls pages are additions, as is showing the mission on screen in place of the cabinet lamp. Mission persistence is clarified in spec §2.5.
- **Follow-ups:** none blocking. Independent review: rung 1 (Codex CLI, its own sign-in), 2 passes.
  - Pass 1: 1 major (the Ready-screen mission was discarded at Start), fixed test-first. 2 minors fixed: anchored initials and game-over assertions, and attract cycling verified by stepping.
  - Pass 2: clean.
- **Artifacts:** `test-results/` (gitignored); contact sheets in the session scratchpad `p7sheets/`, not committed.
