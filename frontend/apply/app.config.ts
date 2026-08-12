import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const applyRoot = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(applyRoot, '../..')

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? 'https://apply.groupher.com/' : '/',
  define: {
    'process.env.NEXT_PUBLIC_AUTH_ENDPOINT': JSON.stringify(process.env.NEXT_PUBLIC_AUTH_ENDPOINT),
  },
  publicDir: path.join(applyRoot, 'public'),
  resolve: { tsconfigPaths: true },
  server: {
    port: Number.parseInt(process.env.PORT || '3006', 10),
    strictPort: true,
    allowedHosts: ['apply.groupher.localhost', 'groupher.localhost'],
    ws: {
      protocol: 'wss',
      host: 'groupher.localhost',
      clientPort: 443,
      path: '__apply_hmr',
    },
    fs: { allow: [repoRoot] },
  },
  plugins: [
    ...(process.env.E2E_AUTH_STACK === '1'
      ? []
      : [cloudflare({ viteEnvironment: { name: 'ssr' } })]),
    tanstackStart({ router: { basepath: '/apply' } }),
    viteReact(),
    tailwindcss(),
  ],
})
