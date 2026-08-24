import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const communityRoot = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(communityRoot, '../..')
const communityPort = Number.parseInt(process.env.PORT || '3007', 10)
const isDevelopment = process.env.NODE_ENV !== 'production'
const eagerlyLoadedRouteIds = new Set(['/$community', '/$community/post/_layout'])

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? 'https://community.groupher.com/' : '/',
  define: {
    'process.env.NEXT_PUBLIC_AUTH_ENDPOINT': JSON.stringify(process.env.NEXT_PUBLIC_AUTH_ENDPOINT),
  },
  publicDir: path.join(communityRoot, 'public'),
  resolve: { tsconfigPaths: true },
  server: {
    port: communityPort,
    strictPort: true,
    allowedHosts: ['community.groupher.localhost', 'groupher.localhost'],
    ws: {
      protocol: isDevelopment ? 'ws' : 'wss',
      host: 'community.groupher.localhost',
      clientPort: isDevelopment ? communityPort : 443,
      path: '__community_hmr',
    },
    fs: { allow: [repoRoot] },
  },
  ssr: { noExternal: ['@groupher/tooltip'] },
  plugins: [
    ...(process.env.E2E_AUTH_STACK === '1'
      ? []
      : [cloudflare({ viteEnvironment: { name: 'ssr' } })]),
    tanstackStart({
      router: {
        codeSplittingOptions: {
          splitBehavior: ({ routeId }) => (eagerlyLoadedRouteIds.has(routeId) ? [] : undefined),
        },
      },
    }),
    viteReact(),
    tailwindcss(),
  ],
})
