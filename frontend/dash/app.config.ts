import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const dashRoot = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(dashRoot, '../..')
const dashPort = Number.parseInt(process.env.PORT || '3005', 10)
const isDevelopment = process.env.NODE_ENV !== 'production'

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? 'https://dash.groupher.com/' : '/',
  define: {
    'process.env.NEXT_PUBLIC_AUTH_ENDPOINT': JSON.stringify(process.env.NEXT_PUBLIC_AUTH_ENDPOINT),
  },
  publicDir: path.join(dashRoot, 'public'),
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: dashPort,
    strictPort: true,
    allowedHosts: ['dash.groupher.localhost', 'main.groupher.localhost', 'groupher.localhost'],
    ws: {
      protocol: isDevelopment ? 'ws' : 'wss',
      host: 'dash.groupher.localhost',
      clientPort: isDevelopment ? dashPort : 443,
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
  plugins: [
    ...(process.env.E2E_AUTH_STACK === '1'
      ? []
      : [cloudflare({ viteEnvironment: { name: 'ssr' } })]),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
  ],
})
