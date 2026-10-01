# Phase 4: Game Flow and High-Score Storage

## Goal

Add the game state machine (credits, coin-for-fuel, mode selection, turn lifecycle, game
over) and persistent high scores, still DOM-free apart from the storage adapter.

## Work

- [ ] `src/sim/game.ts` — states: attract → credit → mode select → playing → landed/crashed → (next turn | game over) → initials entry → attract.
- [ ] Coin handling: each coin adds credit or fuel per the spec; coins are accepted mid-game and add fuel to the current game.
- [ ] Mode selection before start (Training / Cadet / Prime / Command), with the chosen mode's constants applied.
- [ ] Turn lifecycle: after a landing or crash, the score is added, the score and message are shown for the spec's duration, then a new descent begins. The game ends when fuel runs out and the last landing or crash has resolved.
- [ ] Events emitted per step (`thrustLevel`, `lowFuel`, `crash`, `landed`, `coin`, …) for the audio and render layers.
- [ ] `src/storage/highscores.ts` — top-N table with 3-letter initials, a versioned `localStorage` key, every read and write in try/catch, and an in-memory fallback.

## Tests

_Logic: write each failing test first._

- [ ] `tests/unit/game.test.ts` — attract until a coin; the coin gives the spec's fuel amount; a mid-game coin adds fuel; mode constants are applied; the score accumulates across turns; game over at empty fuel after the final outcome; the qualifying-score → initials-entry transition; events are emitted.
- [ ] `tests/unit/highscores.test.ts` — ordering; the top-N cap; save/load round-trip; schema-version mismatch resets the table; storage that throws falls back to memory without crashing.

## Verification

```bash
npx vitest run tests/unit/game.test.ts tests/unit/highscores.test.ts tests/unit/determinism.test.ts
npx tsc --noEmit
npx eslint src/sim src/storage tests/unit
```

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
