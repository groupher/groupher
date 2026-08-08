import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'

const dashRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(
        dashRoot,
        '../core/unit/DashboardThread/CMS/Docs/ActionSnackbar/RevisionDrawer/diff.worker.ts',
      ),
      fileName: () => 'worker-revision-diff.js',
      formats: ['es'],
    },
    minify: true,
    outDir: resolve(dashRoot, 'public'),
    target: 'es2022',
  },
})
