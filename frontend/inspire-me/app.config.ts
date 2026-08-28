import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const appRoot = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(appRoot, '../..')
const port = Number.parseInt(process.env.PORT || '3010', 10)
const isDevelopment = process.env.NODE_ENV !== 'production'

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? 'https://inspire-me.groupher.com/' : '/',
  publicDir: path.join(appRoot, 'public'),
  resolve: { tsconfigPaths: true },
  server: {
    port,
    strictPort: true,
    allowedHosts: ['inspire-me.groupher.localhost', 'groupher.localhost'],
    ws: {
      protocol: isDevelopment ? 'ws' : 'wss',
      host: 'inspire-me.groupher.localhost',
      clientPort: isDevelopment ? port : 443,
      path: '__inspire_me_hmr',
    },
    fs: { allow: [repoRoot] },
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
  ],
})
