import { defineConfig, devices } from '@playwright/test';

// Mandatory viewport matrix for visual verification (desktop Macs only).
const viewports = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
];

// WebKit is excluded: on macOS 14 Playwright ships a frozen WebKit build that fails at
// page creation ("Unknown setting: PushAPIEnabled"). Safari is verified manually instead.
const browsers = [{ name: 'chromium', device: devices['Desktop Chrome'] }];

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: browsers.flatMap((b) =>
    viewports.map((v) => ({
      name: `${b.name}-${v.name}`,
      use: { ...b.device, viewport: { width: v.width, height: v.height } },
    })),
  ),
});
