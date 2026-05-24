import { defineConfig } from 'vitest/config'

/**
 * Lightweight config for pure unit tests that don't need a DB/Redis connection.
 * Used by: src/services/upload.service.test.ts and similar isolated tests.
 *
 * Run with: vitest run --config vitest.unit.config.ts <path>
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // No setupFiles — avoids DB/Redis connection in the global setup
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    env: { NODE_ENV: 'test' },
    testTimeout: 10_000,
  },
})
