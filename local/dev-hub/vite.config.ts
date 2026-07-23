import path from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const apiPort = process.env.DEV_HUB_API_PORT || '4311'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.join(rootDir, 'src/client'),
      '@shared': path.join(rootDir, 'src/shared'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${apiPort}`,
      },
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
})
