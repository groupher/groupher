import path from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const landingRoot = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(landingRoot, '../..')
const landingPort = Number.parseInt(process.env.PORT || '3002', 10)
const isDevelopment = process.env.NODE_ENV !== 'production'

export default defineConfig({
  publicDir: path.join(landingRoot, 'public'),
  resolve: { tsconfigPaths: true },
  server: {
    port: landingPort,
    strictPort: true,
    allowedHosts: ['landing.groupher.localhost', 'groupher.localhost'],
    ws: {
      protocol: isDevelopment ? 'ws' : 'wss',
      host: 'landing.groupher.localhost',
      clientPort: isDevelopment ? landingPort : 443,
      path: '__landing_hmr',
    },
    fs: { allow: [repoRoot] },
  },
  ssr: { noExternal: ['@groupher/tooltip'] },
  plugins: [
    tanstackStart({
      spa: { enabled: false },
      sitemap: { enabled: false },
      pages: [
        { path: '/', prerender: { enabled: true } },
        { path: '/pricing', prerender: { enabled: true } },
        { path: '/book-demo', prerender: { enabled: true } },
        { path: '/404', prerender: { enabled: true } },
      ],
      prerender: {
        enabled: true,
        concurrency: 1,
        autoStaticPathsDiscovery: false,
        crawlLinks: false,
        filter: ({ path }) => path !== '/health',
      },
    }),
    viteReact(),
    tailwindcss(),
  ],
})
