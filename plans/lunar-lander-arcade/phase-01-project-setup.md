# Phase 1: Project Setup and Quality Checks

## Goal

Create the TypeScript/Vite project, its test and lint tooling, and a single quality-gate
command, so every later phase has a working build and one validation entry point.

## Work

- [x] Run `git init` in the project directory and add a `.gitignore` covering `node_modules/`, `dist/`, `test-results/`, `playwright-report/`.
- [x] Create `package.json` with scripts `dev`, `build`, `preview`, `test`, `typecheck`, `lint`, `e2e`; install Vite, TypeScript, Vitest, ESLint (typescript-eslint) and `@playwright/test` as dev dependencies, then install Playwright's Chromium browser.
- [x] Add `tsconfig.json` (strict mode) and `vite.config.ts`.
- [x] Add `eslint.config.js`, including a rule (for example `no-restricted-globals` / `no-restricted-imports`) that keeps `src/sim/**` DOM-free.
- [x] Add `playwright.config.ts`: start the Vite server via `webServer`, run in Chromium (WebKit excluded — see Deviations), and define the viewport matrix (1280×800, 1440×900, 1920×1080).
- [x] Add `index.html` and a stub `src/main.ts` that fills the window with a black canvas.
- [x] Add executable `scripts/validate.sh` that runs `typecheck`, `lint` and `test` in order and stops at the first failure.
- [x] Add a placeholder test so `npm test` has something to run.

## Tests

_Wiring: tests written alongside._

- [x] `tests/unit/smoke.test.ts` — confirms Vitest runs (later replaced by real tests).
- [x] `tests/e2e/smoke.spec.ts` — the page loads and a full-window canvas is present.

## Verification

```bash
npm run typecheck && npm run lint && npm test
npm run build
npx playwright test tests/e2e/smoke.spec.ts
./scripts/validate.sh
```

## Gate

- [x] Author review completed.
- [x] Independent review has no open blocker/major.

## Evidence

_Filled at the gate; what a human reads and what `as-built.md` is assembled from. The
independent review reads the diff, not this._

- **Outcome:** shipped — Vite 8 + TypeScript 6 (strict) + Vitest 4 + ESLint 10 + Playwright 1.63 scaffold, a black full-window canvas stub, and `scripts/validate.sh` (typecheck → lint → unit tests). The DOM-free rule for `src/sim` is enforced by type checking (`tsconfig.sim.json`, no DOM lib) as well as lint.
- **Changed:** `.gitignore`, `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.sim.json`, `vite.config.ts`, `eslint.config.js`, `playwright.config.ts`, `index.html`, `src/main.ts`, `src/sim/index.ts`, `scripts/validate.sh`, `tests/unit/smoke.test.ts`, `tests/e2e/smoke.spec.ts`; git repo initialised on branch `feat/lunar-lander`.
- **Verified:** `./scripts/validate.sh` → OK; `npm run build` → OK; `npx playwright test tests/e2e/smoke.spec.ts` → 3 passed (Chromium × 3 viewports). Three boundary probes (`globalThis.document`, `HTMLElement`, `import '../render'`) each fail both `tsc -p tsconfig.sim.json` and ESLint. Ran in this context (orchestrator), not delegated.
- **Deviations:** WebKit dropped from the Playwright matrix. On macOS 14 (Darwin 23.5) Playwright ships a frozen `webkit_mac14_arm64_special` build that fails at page creation with `Protocol error (Page.overrideSetting): Unknown setting: PushAPIEnabled`. Safari coverage moves to manual checks (plan success criteria "Performance" and "Manual playtest" already require Safari by hand). Phase doc corrected to match. The repository has **no git remote**, so Publish commits locally and skips the push.
- **Follow-ups:** none. Independent review: rung 1 (Codex CLI, its own sign-in), 2 passes. Pass 1 found 1 major (sim boundary not enforced; fixed) and 1 minor (smoke test checked body styling, not the canvas; fixed). Pass 2 was clean.
- **Artifacts:** none (Playwright output in gitignored `test-results/`).
