# Phase 6: Sound

## Goal

Add synthesized Web Audio effects modeled on the arcade's sounds, driven by simulation
events and respecting browser autoplay rules.

## Work

- [ ] `src/audio/synth.ts` — a filtered-noise thrust rumble whose gain and cutoff follow the thrust level; low-fuel and alert beeps; a crash explosion (noise burst with a decay envelope); the coin/credit tone. No sampled audio.
- [ ] Create or resume the `AudioContext` on the first key press or coin; before that, calls do nothing.
- [ ] Wire simulation events into the synth in `src/main.ts`; `M` toggles mute.
- [ ] Add a `?test` flag that records audio events, so Playwright can assert them without listening.

## Tests

_UI and wiring: tests written alongside._

- [ ] `tests/unit/synth.test.ts` — with a stubbed `AudioContext`: nothing is created before the first gesture; thrust gain follows thrust level; each event triggers its sound; mute silences everything.
- [ ] `tests/e2e/sound.spec.ts` — coin → start → thrust → crash records the expected audio-event sequence.

## Verification

```bash
npx vitest run tests/unit/synth.test.ts
npx playwright test tests/e2e/sound.spec.ts
npx tsc --noEmit
npx eslint src/audio src/main.ts tests
```

Listen by hand in Safari and Chrome: the rumble follows thrust smoothly with no clicks, the low-fuel beep fires at the threshold, and the explosion and coin sounds play.

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
