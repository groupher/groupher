import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'

const dashboardRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(
        dashboardRoot,
        '../core/unit/DashboardThread/CMS/Docs/ActionSnackbar/RevisionDrawer/diff.worker.ts',
      ),
      fileName: () => 'worker-revision-diff.js',
      formats: ['es'],
    },
    minify: true,
    outDir: resolve(dashboardRoot, 'public'),
    target: 'es2022',
  },
})
