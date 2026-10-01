# Plan: Atari 1979 Lunar Lander — Browser Recreation

## Status

| Field | Value |
|---|---|
| Format | v2 |
| Suite | plan-init / plan-phase / plan-run |

## Goal

Build a faithful, locally run browser recreation of Atari's 1979 vector-graphics arcade
*Lunar Lander* for Apple Silicon Macs. It should match the original as closely as
documented sources allow: monochrome vector look, scrolling and zooming terrain, multiplier
landing pads, the four difficulty modes (Training, Cadet, Prime, Command), keyboard
equivalents of the thrust lever, rotate and abort controls, coin-for-fuel purchase,
original-style scoring and messages, synthesized sound, and a persistent high-score table.
The end state is one command (`npm run dev`, or `npm run build && npm run preview`) that
serves a game you can play in Safari or Chrome on macOS.

## Success Criteria

- [ ] **Fidelity spec exists and is sourced:** `docs/fidelity-spec.md` records gravity,
      thrust, rotation rate, fuel burn, per-mode differences, scoring table, landing
      tolerances, end-of-landing messages, coin/fuel rules and HUD layout. Each value cites
      a source (Atari operator's manual, MAME driver notes, gameplay footage) or is marked
      as an estimate.
- [ ] **Unit tests pass:** `npm test` (Vitest) is green, covering physics integration,
      fuel burn, landing/crash classification, scoring per pad multiplier and outcome,
      coin → fuel credit, abort behavior, per-mode parameters and high-score persistence.
- [ ] **Deterministic simulation:** a fixed-timestep run from the same seed and the same
      scripted input produces identical state. A test asserts this.
- [ ] **Type-check and build are clean:** `npm run typecheck` and `npm run build` finish
      with zero errors.
- [ ] **Controls work as specified:** thrust is a ramped "lever" level (keys raise and
      lower thrust gradually, not on/off), ←/→ rotate, Space aborts, `5`/`C` inserts a
      coin and `1` starts. The mapping is shown on the attract screen. There is no
      gamepad code.
- [ ] **Coin/fuel flow:** attract mode loops until a coin is inserted. Each coin adds the
      documented fuel amount (750 units per the original, confirmed in the spec).
      Inserting a coin mid-game adds fuel. The game ends when fuel runs out and the final
      landing or crash resolves.
- [ ] **Difficulty modes:** all four modes can be selected before start. Their
      differences, as documented in the spec, are visible in play and covered by tests.
- [ ] **Scoring and messages:** each landing outcome awards the spec's points × pad
      multiplier (or the crash value), applies fuel bonuses or penalties, and shows the
      matching original-style message.
- [ ] **Terrain and zoom:** terrain scrolls or wraps horizontally, pads show 2×–5× labels,
      and the view zooms in on approach near the ground, as in the arcade.
- [ ] **Sound:** synthesized Web Audio (no sampled ROM audio) plays the thrust rumble
      scaled to the thrust level, low-fuel and alert beeps, a crash explosion and the
      coin/credit sound. Audio starts on the first user gesture, so the browser autoplay
      policy is respected.
- [ ] **High scores:** a local top-N table with arcade-style 3-initial entry survives a
      page reload (stored in `localStorage` with a schema version) and is shown in attract
      mode.
- [ ] **Performance:** a steady 60 fps on an Apple Silicon Mac in Safari and Chrome, with
      no dropped-frame stutter during zoom transitions (checked with the browser
      performance panel).
- [ ] **UI verified:** the Playwright specs for the main flows (attract → coin → start →
      land on a pad → score; crash; buy fuel mid-game; high-score entry → reload →
      persisted) pass **3×** across the mandatory viewport matrix, with
      screenshots/frames **inspected** (not merely produced). Checked with `/web-verify`
      at each UI phase gate.
- [ ] **Manual playtest:** someone familiar with the arcade game plays each mode and
      confirms the feel (gravity, thrust response, rotation) is close to the original.

## Technical Constraints

- **Target platform:** a modern browser (Safari and Chrome, current versions) on Apple
  Silicon macOS, served locally. No native wrapper, no deployment and no other platforms
  are required.
- **Stack:** TypeScript (strict) + Vite + HTML5 Canvas 2D for rendering, Web Audio API for
  sound, Vitest for unit tests, Playwright for end-to-end and visual checks. Node 25 and
  npm are present locally.
- **Vector look:** render everything as thin bright lines on black, with an optional
  phosphor glow (canvas shadow blur or additive blending) and no filled sprites. Use a
  vector font built from line segments for all text, as the original did.
- **Simulation is separate from rendering and input:** a pure, deterministic,
  fixed-timestep `sim` module with no DOM access. Rendering and input are thin layers
  around it. This keeps physics and scoring unit-testable and lets Playwright drive the
  game through a test hook (for example a `?test` query that exposes seeded state and
  scripted input).
- **No copyrighted assets:** no ROM code, ROM data, sampled audio or arcade artwork.
  Behavior is reimplemented from published documentation and observation.
- **Input:** keyboard only. Gamepad API code is excluded on purpose.
- **Persistence:** high scores in `localStorage` with a versioned key. Every read and
  write is wrapped in try/catch, so private mode or blocked storage falls back to an
  in-memory table instead of crashing.
- **Audio:** the `AudioContext` is created or resumed on the first key press or coin, per
  browser autoplay rules.
- **Quality gate:** the project has none yet. Add `npm run typecheck`, `npm test`,
  `npm run lint` and a `scripts/validate.sh` that runs all three, so phase gates have one
  command to call. Pre-commit hooks are optional.
- **Not yet a git repo:** the project directory needs `git init` before the first phase
  commit (a prerequisite for `/plan-run`).

## Non-Goals

- Game controller or gamepad support (explicitly declined)
- Mobile, touch, or non-Apple and non-Mac platforms
- Native macOS app packaging (Electron, Tauri, Swift)
- Online or global high scores, accounts, or any network backend
- Multiplayer, level editor, or new gameplay beyond the 1979 original
- Emulating the original hardware or ROM (this is a reimplementation, not an emulator)
- Home-computer or later-era Lunar Lander variants

## Assumptions

- **Exact original constants are not all published.** Phase 1 builds
  `docs/fidelity-spec.md` from available sources, and values that cannot be confirmed are
  tuned by feel and marked as estimates. If authoritative values turn up later, only the
  spec and the constants module change.
- **The done criteria were not specified beyond fidelity.** The criteria above (tests,
  Playwright flows, 60 fps, manual playtest) are my defaults.
- **No other non-goals were given.** The list above is inferred from scope.
- **The output location was not confirmed.** The default `plans/lunar-lander-arcade/`
  was used.
- **Key mapping defaults:** ↑/W raise thrust and ↓/S lower it (lever), ←/→ or A/D rotate,
  Space aborts, `5`/`C` inserts a coin, `1` starts, `M` mutes. Changing these touches only
  `src/input/`.

## Affected Areas

The project is greenfield; all paths are new.

**Will change:**
- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html` — project scaffold and
  scripts (`dev`, `build`, `preview`, `test`, `typecheck`, `lint`, `e2e`)
- `scripts/validate.sh` — single quality-gate command
- `docs/fidelity-spec.md` — sourced constants, rules and HUD layout
- `src/sim/constants.ts` — per-mode physics/fuel/scoring constants (from the spec)
- `src/sim/lander.ts` — lander state, thrust/rotation/abort integration, fuel burn
- `src/sim/terrain.ts` — terrain generation/wrapping, pad placement and multipliers
- `src/sim/landing.ts` — touchdown classification (great/good/hard/crash) and scoring
- `src/sim/game.ts` — game state machine (attract, credit, playing, landed/crashed,
  game over, initials entry) and coin/fuel credit
- `src/render/vector.ts` — line renderer with phosphor glow and camera/zoom transform
- `src/render/font.ts` — line-segment vector font
- `src/render/hud.ts` — score, time, fuel, altitude, horizontal/vertical speed, messages
- `src/render/scene.ts` — lander, flame, terrain, pads, explosion debris
- `src/audio/synth.ts` — Web Audio thrust rumble, beeps, explosion, coin sound
- `src/input/keyboard.ts` — key mapping, thrust-lever ramp
- `src/storage/highscores.ts` — versioned `localStorage` table with in-memory fallback
- `src/main.ts` — fixed-timestep loop wiring sim, render, audio, input; test hook

**Must stay consistent:**
- `docs/fidelity-spec.md` ↔ `src/sim/constants.ts` — constants must trace to the spec
- `src/sim/*` must stay DOM-free, because render, audio and tests all depend on it

**Tests** _(TDD preferred: write failing tests before the implementation that makes them pass)_**:**
- `tests/unit/lander.test.ts` — gravity/thrust integration, rotation, fuel burn, abort
- `tests/unit/landing.test.ts` — touchdown classification thresholds, score × multiplier
- `tests/unit/game.test.ts` — state machine, coin → fuel, game over on empty fuel, modes
- `tests/unit/determinism.test.ts` — same seed + inputs ⇒ identical state
- `tests/unit/highscores.test.ts` — ordering, top-N cap, persistence, storage-failure fallback
- `tests/e2e/*.spec.ts` (Playwright) — attract/coin/start, land, crash, mid-game fuel
  purchase, initials entry + reload persistence, with screenshots across viewports

---

_Work breakdown lives in the phase documents and execution.md, produced by /plan-phase._
