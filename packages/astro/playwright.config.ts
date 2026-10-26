import { defineConfig, devices } from '@playwright/test';

// Browser tests of the Editor, against the fixture Site as `astro build`
// leaves it in test/fixture/dist/. Run them with `mise run test:browser`,
// which builds the packages and the fixture first.
//
// 0 lets the OS pick a free port, so parallel runs never meet. Set
// EDITY_TEST_PORT to pin one.
const port = process.env.EDITY_TEST_PORT ?? '0';

export default defineConfig({
  testDir: './test/browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    // Set by webServer.wait below, before the workers start.
    baseURL: process.env.EDITY_BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    // WebKit at 390 px with touch, as on an iPhone.
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    cwd: './test/fixture',
    // --ignore-lock keeps Astro in the foreground when it detects an agent.
    command: `pnpm exec astro preview --ignore-lock --host 127.0.0.1 --port ${port}`,
    // No `url`: Playwright would probe it before starting the server, and on
    // some machines a closed port hangs instead of refusing. The named group
    // becomes EDITY_BASE_URL, the address Astro actually took.
    wait: { stdout: /Local\s+(?<edity_base_url>http:\/\/[\d.]+:\d+)/ },
    timeout: 60_000,
  },
});
