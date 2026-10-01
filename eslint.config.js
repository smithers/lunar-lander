import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    // Playwright page.evaluate callbacks reach the untyped window.__lunar test hook.
    files: ['tests/e2e/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    // The simulation must stay DOM-free so it is deterministic and unit-testable.
    // The authoritative check is tsconfig.sim.json (no DOM lib); these rules catch the
    // common cases early in the editor.
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'localStorage',
        'requestAnimationFrame',
        'performance',
        'AudioContext',
        'HTMLElement',
        'HTMLCanvasElement',
      ],
      'no-restricted-properties': [
        'error',
        { object: 'globalThis', property: 'document' },
        { object: 'globalThis', property: 'window' },
        { object: 'globalThis', property: 'localStorage' },
        { object: 'globalThis', property: 'navigator' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '**/render', '**/render/**', '**/audio', '**/audio/**', '**/input', '**/input/**',
            '**/storage', '**/storage/**', '**/main', '**/main.ts',
          ],
        },
      ],
    },
  },
);
