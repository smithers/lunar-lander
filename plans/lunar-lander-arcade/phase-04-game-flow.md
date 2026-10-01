# Phase 4: Game Flow and High-Score Storage

## Goal

Add the game state machine (credits, coin-for-fuel, mode selection, turn lifecycle, game
over) and persistent high scores, still DOM-free apart from the storage adapter.

## Work

- [x] `src/sim/game.ts` — states: attract → credit → mode select → playing → landed/crashed → (next turn | game over) → initials entry → attract.
- [x] Coin handling: each coin adds credit or fuel per the spec; coins are accepted mid-game and add fuel to the current game.
- [x] Mode selection before start (Training / Cadet / Prime / Command), with the chosen mode's constants applied.
- [x] Turn lifecycle: after a landing or crash, the score is added, the score and message are shown for the spec's duration, then a new descent begins. The game ends when fuel runs out and the last landing or crash has resolved.
- [x] Events emitted per step (`thrustLevel`, `lowFuel`, `crash`, `landed`, `coin`, …) for the audio and render layers.
- [x] `src/storage/highscores.ts` — top-N table with 3-letter initials, a versioned `localStorage` key, every read and write in try/catch, and an in-memory fallback.

## Tests

_Logic: write each failing test first._

- [x] `tests/unit/game.test.ts` — attract until a coin; the coin gives the spec's fuel amount; a mid-game coin adds fuel; mode constants are applied; the score accumulates across turns; game over at empty fuel after the final outcome; the qualifying-score → initials-entry transition; events are emitted.
- [x] `tests/unit/highscores.test.ts` — ordering; the top-N cap; save/load round-trip; schema-version mismatch resets the table; storage that throws falls back to memory without crashing.

## Verification

```bash
npx vitest run tests/unit/game.test.ts tests/unit/highscores.test.ts tests/unit/determinism.test.ts
npx tsc --noEmit
npx eslint src/sim src/storage tests/unit
```

## Gate

- [x] Author review completed.
- [x] Independent review has no open blocker/major.

## Evidence

_Filled at the gate; what a human reads and what `as-built.md` is assembled from. The
independent review reads the diff, not this._

- **Outcome:** shipped — `src/sim/game.ts` and `src/storage/highscores.ts`.
  - **Game states:** attract → ready → playing → landed → next round or game over → initials → attract or ready.
  - **Coins:** each coin adds fuel at any time and restores control after running dry.
  - **Mission select:** Select Game cycles the mission at any time and resets yaw. A new game starts in Training.
  - **Timers:** round and crash-allowance timers in NMI units. The crash fuel penalty is allowance minus fuel used. The game ends 5 s after running dry.
  - **Perfect landing on an empty tank:** the +50 bonus restores fuel and play continues, as in the ROM.
  - **Rounds:** terrain is kept for the whole game, with a random start offset each round.
  - **Initials entry:** letter edges plus auto-repeat.
  - **Events:** thrustLevel, lowFuel (flash phase), outOfFuel, coin, abort, crash, landed, gameOver and highScore, for the audio and render layers.
  - **High scores:** a top-10 table under a versioned key, sorted on load, with a memory fallback when storage is missing or throws.
- **Changed:** `src/sim/game.ts`, `src/storage/highscores.ts` (new); `src/sim/constants.ts` (NMI timing, GAME_OVER_FRAMES); `tests/unit/game.test.ts`, `tests/unit/highscores.test.ts` (new); `docs/fidelity-spec.md` §5 and §7 wording.
- **Verified:** scoped vitest run → OK. `./scripts/validate.sh` → OK (82 unit tests). Tests were written first and confirmed red (missing modules) before implementation. Ran in this context.
- **Deviations:**
  - The sim does not import storage. `GameConfig.qualifies` is injected, and the `highScore` event carries the entry for the browser layer to save.
  - Phase 3's per-round terrain regeneration is replaced by per-game terrain with a per-round start offset (spec §7).
  - GAME_OVER display time is 164 frames (≈ 4 s), an estimate.
- **Follow-ups:** none blocking. Independent review: rung 1 (Codex CLI, its own sign-in), 2 passes, then adjudication.
  - Pass 1: 1 major, refuted with ROM evidence. A perfect landing at zero fuel continues play, because `$6313` sets fuel_state and `$6008` only ends the game when it is clear. Spec clarified and a test pins it. The minor finding about unsorted loaded tables was fixed.
  - Pass 2: 1 major (terrain regenerated each round, contrary to spec §7). Adjudicated and fixed: terrain per game, start offset per round. The ROM's per-round pad-set change is not reproduced and is documented in spec §7.
- **Artifacts:** none.
