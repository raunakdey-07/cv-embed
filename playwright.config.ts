import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PW_PORT || '4174')
const baseURL = `http://127.0.0.1:${port}`

// Cross-browser coverage for the behaviours that actually differ between
// rendering engines: layout and reflow, font metrics, focus handling, form
// editing, storage, and the iframe bridge. Purely visual or Chromium-specific
// flows stay on the primary projects.
const FIREFOX_SUITE = [
  'default-state.spec.ts',
  'tech-stack-input.spec.ts',
  'accessibility-basics.spec.ts',
  'builder-qol.spec.ts',
  'order-sync.spec.ts',
  'summary-nav.spec.ts',
  'pane-transition.spec.ts',
  'embed-panel.spec.ts',
  'embed-reliability.spec.ts',
  'sdk-contract.spec.ts',
  'pdf-lazy-load.spec.ts',
]

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
    // Firefox runs the cross-cutting suite only. The mobile overflow regression
    // that broke CI was caused by web font metrics, which is exactly where
    // engines diverge, so layout and font behaviour need a second engine.
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: FIREFOX_SUITE,
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: `${baseURL}/builder`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
