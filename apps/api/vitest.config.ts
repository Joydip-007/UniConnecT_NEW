import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    // The AI worker's per-minute quota guard sleeps out the remainder of the wall-clock
    // minute once the cap is hit. The AI calls are mocked in tests, so raise the cap high
    // enough that the suite never pays that real 60s stall.
    env: { NODE_ENV: 'test', AI_CALLS_PER_MINUTE: '100000' },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    sequence: { concurrent: false },
  },
})
