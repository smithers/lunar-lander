# Lunar Lander

A browser game containing:

- physics, rotation, abort, fuel and scoring rules
- glowing white vector lines on black
- a ×4 close-up near the ground
- coin-for-fuel
- the four missions
- synthesized sound 

It also adds a local high-score table

It runs locally in Safari or Chrome on a Mac. Nothing is sent over the network.

> **Unofficial fan recreation.** This project is not affiliated with, endorsed by, or
> connected to Atari. *Lunar Lander* is a trademark of its respective owner. No original ROM
> code, ROM data, artwork or sound recordings are included: the graphics, terrain, font and
> sound are original, and the game rules were re-implemented from public documentation and
> an annotated disassembly. It is a non-commercial hobby project.

## Play online

**https://lunar-lander.lunar-lander.workers.dev**, hosted free on Cloudflare Workers.

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

### Deploy your own copy

The build is plain static files, served as Cloudflare Workers static assets (free plan, no
server code). With a Cloudflare account:

```bash
npx wrangler login   # once
npm run deploy       # builds, then uploads ./dist
```

## How to play

Insert a coin to buy fuel, choose a mission, and press Start. Land gently on a flat pad.
Narrow pads score more (2× to 5×). The game ends when you run out of fuel, but a coin at any
time buys more, even mid-flight.

| Key | Action |
|---|---|
| Space (hold) | Fire the engine. Releasing Space cuts the thrust. |
| ↑ / W | More engine power (it stays where you leave it; starts at full) |
| ↓ / S | Less engine power |
| ← / A | Rotate left |
| → / D | Rotate right |
| X | Abort: right the lander and burn hard upward (costly in fuel) |
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
| `src/input/` | Keyboard → engine, power level and controls |
| `src/storage/` | High scores in `localStorage` |
| `plans/` | The plan this was built from |

## Checks

```bash
./scripts/validate.sh   # type-check, lint, unit tests
npm run e2e             # Playwright end-to-end and visual flows (Chromium)
```

`?test&seed=N` in the URL fixes the random seed and exposes a test hook (`window.__lunar`).
The end-to-end tests use it to drive the game.
