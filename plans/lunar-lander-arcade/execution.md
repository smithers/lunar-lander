# Execution: Atari 1979 Lunar Lander — Browser Recreation

_Execution tracker for [plan.md](./plan.md). The orchestrator owns this file._

## Phases

Phases 1 and 2 are independent of each other: their files do not overlap (project setup
files vs. `docs/fidelity-spec.md`) and they share nothing else. Phase 3 reconciles them by
turning the spec into `src/sim/constants.ts` and running the first real tests on the new
tooling. All later phases run in order, because they share the simulation API and
`src/main.ts`.

- [x] [Phase 1: Project Setup and Quality Checks](./phase-01-project-setup.md)
- [x] [Phase 2: Fidelity Spec](./phase-02-fidelity-spec.md)
- [x] [Phase 3: Simulation Core](./phase-03-simulation-core.md)
- [x] [Phase 4: Game Flow and High-Score Storage](./phase-04-game-flow.md)
- [x] [Phase 5: Vector Graphics, HUD, Controls and Main Loop](./phase-05-vector-rendering-and-controls.md)
- [ ] [Phase 6: Sound](./phase-06-sound.md)
- [ ] [Phase 7: Attract Mode, Initials Entry and Full Playwright Flows](./phase-07-attract-mode-and-flows.md)
- [ ] [Phase 8: Final Verification and Playtest](./phase-08-final-verification.md)
