import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for dot art 3D converter E2E testing
 */
export default defineConfig({
  // Test directory
  testDir: './e2e',
  
  // Global setup and teardown
  globalSetup: require.resolve('./e2e/setup.ts'),
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI.
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: [
    ['list'],
    ['html'],
    ['json', { outputFile: 'e2e-results.json' }]
  ],
  
  // Global test timeout
  timeout: 30000,
  
  // Expected timeout for each assertion
  expect: {
    timeout: 5000,
  },
  
  use: {
    // Base URL to use in actions like `await page.goto('/')`.
    baseURL: 'http://localhost:4173',
    
    // Collect trace when retrying the failed test.
    trace: 'on-first-retry',
    
    // Record video on failure
    video: 'retain-on-failure',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Viewport size
    viewport: { width: 1280, height: 720 },
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile browsers
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});