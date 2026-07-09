import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/services/setup.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    env: { NODE_ENV: 'test' },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    sequence: { concurrent: false },
    include: ['src/services/**/*.test.ts'],
  },
})
