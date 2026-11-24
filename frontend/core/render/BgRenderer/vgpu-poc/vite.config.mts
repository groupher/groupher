import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { wgslVitePlugin } from '@vgpu/wgsl/loader-vite'
import { defineConfig } from 'vite'

const pocRoot = path.dirname(fileURLToPath(import.meta.url))
const coreRoot = path.resolve(pocRoot, '../../..')

export default defineConfig({
  root: pocRoot,
  resolve: {
    alias: { '~': coreRoot },
  },
  plugins: [wgslVitePlugin()],
  build: {
    outDir: path.join(coreRoot, '.tmp/vgpu-poc'),
    emptyOutDir: true,
    sourcemap: true,
  },
})
