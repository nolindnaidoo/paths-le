import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    pool: 'threads',
    include: ['src/extraction/performance.bench.ts'],
    testTimeout: 60000,
  },
  resolve: {
    alias: {
      vscode: '@vscode/test-electron',
    },
  },
})

