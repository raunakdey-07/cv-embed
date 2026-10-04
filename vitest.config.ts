import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // The bridge protocol lives in sdk/ because the shipped SDK artifact and
    // the app both import it, so its tests live there too.
    include: ['src/**/*.test.ts', 'sdk/**/*.test.ts'],
    globals: true,
  },
})
