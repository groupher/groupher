// @ts-nocheck
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

// This config is shared by frontend apps and Hono backend apps.
// Run with: `vitest --config frontend/core/vitest.config.mts`
const configDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(configDir, '../..')

const workspaceTsconfigProjects = (workspaceRoot: string) =>
  fs
    .readdirSync(path.join(repoRoot, workspaceRoot), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(workspaceRoot, d.name, 'tsconfig.json'))
    .filter((p) => fs.existsSync(path.join(repoRoot, p)))

const tsconfigProjects = ['frontend', 'backend'].flatMap((workspaceRoot) =>
  workspaceTsconfigProjects(workspaceRoot),
)

export default defineConfig({
  root: repoRoot,
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
