// @ts-nocheck
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// This config is shared by frontend apps and Hono backend apps.
// Run with: `vitest --config frontend/core/vitest.config.mts`
const configDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(configDir, '../..')

export default defineConfig({
  root: repoRoot,
  resolve: { tsconfigPaths: true },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: [path.join(repoRoot, 'frontend/core/vitest.setup.ts')],

    // Colocated tests convention for this monorepo.
    // - legacy: `frontend/**/tests/**/*.test.{ts,tsx}`
    // - new: colocate beside modules (e.g. `hooks/useX/index.test.tsx`)
    include: [
      'frontend/**/*.test.{ts,tsx}',
      'backend/auth/**/*.test.{ts,tsx}',
      'infra/dev-gateway/**/*.test.{ts,tsx}',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],

    globals: true,

    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
  },
})
