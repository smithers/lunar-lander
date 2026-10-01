# Phase 6: Sound

## Goal

Add synthesized Web Audio effects modeled on the arcade's sounds, driven by simulation
events and respecting browser autoplay rules.

## Work

- [x] `src/audio/synth.ts` — a filtered-noise thrust rumble whose gain and cutoff follow the thrust level; low-fuel and alert beeps; a crash explosion (noise burst with a decay envelope); the coin/credit tone. No sampled audio.
- [x] Create or resume the `AudioContext` on the first key press or coin; before that, calls do nothing.
- [x] Wire simulation events into the synth in `src/main.ts`; `M` toggles mute.
- [x] Add a `?test` flag that records audio events, so Playwright can assert them without listening.

## Tests

_UI and wiring: tests written alongside._

- [x] `tests/unit/synth.test.ts` — with a stubbed `AudioContext`: nothing is created before the first gesture; thrust gain follows thrust level; each event triggers its sound; mute silences everything.
- [x] `tests/e2e/sound.spec.ts` — coin → start → thrust → crash records the expected audio-event sequence.

## Verification

```bash
npx vitest run tests/unit/synth.test.ts
npx playwright test tests/e2e/sound.spec.ts
npx tsc --noEmit
npx eslint src/audio src/main.ts tests
```

Listen by hand in Safari and Chrome: the rumble follows thrust smoothly with no clicks, the low-fuel beep fires at the threshold, and the explosion and coin sounds play.

## Gate

- [x] Author review completed.
- [x] Independent review has no open blocker/major.

## Evidence

_Filled at the gate; what a human reads and what `as-built.md` is assembled from. The
independent review reads the diff, not this._

- **Outcome:** shipped — `src/audio/synth.ts`, a Web Audio recreation of the discrete sound circuit.
  - **Thrust rumble:** always on in flight. A 16-bit LFSR noise source clocked at 12 kHz goes through the ROM's 3-bit volume `(level>>1)|1` (7 during abort), a band-pass at 89.5 Hz, a low-pass at 560 Hz and a make-up gain.
  - **Tones and explosion:** a 3 kHz low-fuel beep gated with the 16-frame flash, a 6 kHz coin chirp, and an unfiltered noise-burst explosion with a 1.5 s decay.
  - **Browser behavior:** the AudioContext is created lazily on the first key press or pointer press; `M` mutes with a fade; audio suspends while the tab is hidden; a test-mode event log feeds the e2e checks.
- **Changed:** `src/audio/synth.ts`, `tests/unit/synth.test.ts`, `tests/e2e/sound.spec.ts` (new); `src/main.ts` (synth wiring, unlock, mute, visibilitychange, test-hook `audioLog`/`muted`).
- **Verified:**
  - Scoped vitest run → 6/6. `npx playwright test tests/e2e/sound.spec.ts --repeat-each=3` → 27/27 (Chromium × 3 viewports × 3 runs). Typecheck and lint → OK. `./scripts/validate.sh` → OK.
  - **The listening check could not be done by an agent.** It was replaced by an objective test: render the synth through an `OfflineAudioContext` and check that over 90% of rumble power is below 600 Hz, the beep peaks at 3 kHz ±50 Hz, full thrust is over 4× the idle RMS, and there is no clipping and no sample-to-sample jump over 0.1.
  - That test caught real clipping (peak 1.21) after the 12 kHz LFSR change. The make-up gain was lowered from 4 to 2.5.
  - Ran in this context.
- **Deviations:** the "listen by hand in Safari and Chrome" check is replaced by the offline-render test above. A by-ear check in both browsers is still owed, and is part of Phase 8's manual playtest.
- **Follow-ups:** none blocking. Independent review: rung 1 (Codex CLI, its own sign-in), 2 passes.
  - Pass 1: 2 minors, both fixed: the mute switching instantly instead of fading, and the LFSR advancing at the device sample rate instead of 12 kHz.
  - Pass 2: clean.
- **Artifacts:** none.
