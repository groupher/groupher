/**
 * Implements the Vitest.config boundary inside Press.
 *
 * Business position:
 *
 *   Browser / Gateway
 *     -> Press module
 *     -> cache / Phoenix projection
 *     -> public response
 */

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
