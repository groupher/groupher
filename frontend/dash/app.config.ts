import path from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const dashRoot = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(dashRoot, '../..')

export default defineConfig({
  publicDir: path.join(dashRoot, 'public'),
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: Number.parseInt(process.env.PORT || '3005', 10),
    strictPort: true,
    allowedHosts: ['dash.groupher.localhost', 'main.groupher.localhost', 'groupher.localhost'],
    ws: {
      protocol: 'wss',
      host: 'groupher.localhost',
      clientPort: 443,
      path: '__dash_hmr',
    },
    fs: {
      allow: [repoRoot],
    },
  },
  ssr: {
    // The package is CommonJS. Bundling it preserves the default component import
    // used by the shared core Tooltip during SSR.
    noExternal: ['@groupher/tooltip'],
  },
  plugins: [tanstackStart(), viteReact(), tailwindcss()],
})
