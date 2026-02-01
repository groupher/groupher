import fs from 'node:fs'
import path from 'node:path'

import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

// This config is shared by all `frontend/*` apps.
// Run with: `vitest --config frontend/core/vitest.config.mts`
const repoRoot = process.cwd()

const tsconfigProjects = fs
  .readdirSync(path.join(repoRoot, 'frontend'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => path.join('frontend', d.name, 'tsconfig.json'))
  .filter((p) => fs.existsSync(path.join(repoRoot, p)))

export default defineConfig({
  plugins: [
    tsconfigPaths({
      projects: tsconfigProjects,
    }),
    react(),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: [path.join(repoRoot, 'frontend/core/vitest.setup.ts')],

    // Colocated tests convention for this monorepo.
    include: ['frontend/**/tests/**/*.text.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/build/**'],

    globals: true,

    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
  },
})
