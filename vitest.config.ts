import { defineConfig } from 'vitest/config'

// Unit tests for pure logic (ranking, repo mappers). Playwright stays the E2E
// runner; vitest is scoped to *.test.ts under src/ and never starts a browser.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
