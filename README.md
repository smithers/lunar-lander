# Lunar Lander

A browser recreation of Atari's 1979 vector-graphics arcade game *Lunar Lander*. It is built to
play like the cabinet, which means:

- the same physics, rotation, abort, fuel and scoring rules, taken from the original ROM
- glowing white vector lines on black
- a ×4 close-up near the ground
- coin-for-fuel
- the four missions
- synthesized sound in the style of the original circuit

It also adds a local high-score table, which the original did not have.

It runs locally in Safari or Chrome on a Mac. Nothing is sent over the network.

## Run it

You need [Node.js](https://nodejs.org/) 22 or newer.

```bash
npm install
npm run dev        # then open http://localhost:5173
```

For an optimized build:

```bash
npm run build
npm run preview    # then open http://localhost:4173
```

Click the page or press any key once so the browser lets the game play sound.

## How to play

Insert a coin to buy fuel, choose a mission, and press Start. Land gently on a flat pad.
Narrow pads score more (2× to 5×). The game ends when you run out of fuel, but a coin at any
time buys more, even mid-flight.

| Key | Action |
|---|---|
| ↑ / W | Raise the thrust lever (it stays where you leave it) |
| ↓ / S | Lower the thrust lever |
| ← / A | Rotate left |
| → / D | Rotate right |
| Space | Abort: right the lander and burn hard upward (costly in fuel) |
| 5 or C | Insert a coin (750 fuel units) |
| 1 | Start |
| Tab | Select Game: cycle the mission (also works mid-flight) |
| M | Sound on/off |

When a score makes the table, enter your initials with ← / → and confirm each letter with Space.

### Missions

| Mission | What changes |
|---|---|
| Training | Some friction slows drift, and the lander cannot be rotated past horizontal |
| Cadet | Normal gravity, full rotation |
| Prime | Double gravity, 1.5× thrust, slower fuel burn |
| Command | Rotation has momentum: a tap keeps the lander turning until you counter-tap |

### Scoring

- **Perfect landing** (upright within one rotation step, both speeds under 16): 50 points × the pad multiplier, plus 50 bonus fuel.
- **Hard landing** (upright, horizontal speed under 16, vertical speed 16–31): 15 points × the multiplier.
- **Crash** (anything else, including touching a slope): 5 points × the multiplier, and it can cost fuel.

## Project layout

| Path | What it holds |
|---|---|
| `docs/fidelity-spec.md` | Every gameplay constant, with its source (mostly the ROM disassembly) or marked as an estimate |
| `src/sim/` | Deterministic, browser-free simulation: physics, terrain, landing rules, game states |
| `src/render/` | Vector display, camera, font, HUD and screens |
| `src/audio/` | Web Audio sound |
| `src/input/` | Keyboard → thrust lever and controls |
| `src/storage/` | High scores in `localStorage` |
| `plans/` | The plan this was built from |

## Checks

```bash
./scripts/validate.sh   # type-check, lint, unit tests
npm run e2e             # Playwright end-to-end and visual flows (Chromium)
```

`?test&seed=N` in the URL fixes the random seed and exposes a test hook (`window.__lunar`).
The end-to-end tests use it to drive the game.
