# Phase 7: Attract Mode, Initials Entry and Full Playwright Flows

## Goal

Finish the arcade wrapper around play (the attract loop, the high-score table and
3-letter initials entry) and cover every main flow end to end.

## Work

- [ ] Attract-mode screens in `src/render/` following the spec's sequence: title, "INSERT COIN", key mapping, the high-score table, and a demo descent if the spec includes one.
- [ ] Mode-select screen after a coin, and the game-over screen.
- [ ] Arcade-style initials entry (cycle letters with ←/→, confirm with Space or Enter), saved through `src/storage/highscores.ts`.
- [ ] Write/extend the Playwright specs that drive these flows: `tests/e2e/attract.spec.ts`, `tests/e2e/fuel.spec.ts`, `tests/e2e/highscore.spec.ts`.

## Tests

_UI and wiring: tests written alongside._

- [ ] `tests/e2e/attract.spec.ts` — the attract loop cycles through its screens; the key mapping and high-score table are visible; a coin leaves attract mode.
- [ ] `tests/e2e/fuel.spec.ts` — a mid-game coin raises the HUD fuel by the spec amount.
- [ ] `tests/e2e/highscore.spec.ts` — a qualifying game → initials entry → reload → the entry is still in the table; with storage blocked, the game still runs.

## Verification

```bash
npx playwright test tests/e2e/attract.spec.ts tests/e2e/fuel.spec.ts tests/e2e/highscore.spec.ts --repeat-each=3
npx tsc --noEmit
npx eslint src tests/e2e
```

## Gate

- [ ] Author review completed.
- [ ] Independent review has no open blocker/major.
- [ ] Visual verification passed across the mandatory viewports (`/web-verify`: attract screens, initials entry and high-score table inspected).

## Evidence

- **Outcome:**
- **Changed:**
- **Verified:**
- **Deviations:**
- **Follow-ups:**
- **Artifacts:**
