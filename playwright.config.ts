import { defineConfig, devices } from '@playwright/test';

const production = !!process.env['BOOKMONKEY_TEST_PRODUCTION'];
const baseURL = production ? 'http://localhost:4201' : 'http://localhost:4202';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ],
  webServer: {
    command: production ? 'npm start -- --configuration production --port 4201' : 'npm start -- --port 4202',
    url: baseURL,
    reuseExistingServer: false
  }
});
