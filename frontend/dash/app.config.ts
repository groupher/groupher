import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { cloudflare } from '@cloudflare/vite-plugin'
import { createVgpuWgslVitePlugin } from '@groupher/frontend-core/vgpu-vite'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { redact } from '@tanstack/redact/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { buildAuthEndpoint } from './build-auth-endpoint.ts'

const dashRoot = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(dashRoot, '../..')
const dashPort = Number.parseInt(process.env.PORT || '3005', 10)
const isDevelopment = process.env.NODE_ENV !== 'production'
const isProductionBuild = !isDevelopment || process.env.CLOUDFLARE_ENV === 'production'
const localRoot =
  isDevelopment &&
  process.env.DEV_HUB_MANAGED_ENVIRONMENT === 'true' &&
  /^groupher-[a-z0-9]+(?:-[a-z0-9]+)*\.localhost$/.test(process.env.DEV_HUB_PUBLIC_ROOT || '')
    ? process.env.DEV_HUB_PUBLIC_ROOT
    : undefined
const localDashHost = localRoot ? `dash.${localRoot}` : 'dash.groupher.localhost'

export default defineConfig({
  // Managed local runs consume Hub-injected values, not project dotenv files.
  envDir: process.env.DEV_HUB_MANAGED_ENVIRONMENT === 'true' ? false : undefined,
  base: process.env.NODE_ENV === 'production' ? 'https://dash.groupher.com/' : '/',
  define: {
    'process.env.NEXT_PUBLIC_AUTH_ENDPOINT': JSON.stringify(
      buildAuthEndpoint(process.env.NEXT_PUBLIC_AUTH_ENDPOINT, isProductionBuild),
    ),
  },
  publicDir: path.join(dashRoot, 'public'),
  resolve: {
    alias: {
      ...(process.env.E2E_AUTH_STACK === '1'
        ? { 'cloudflare:workers': path.join(dashRoot, 'src/server/cloudflare-workers.e2e.ts') }
        : {}),
      'react-compiler-runtime': '@tanstack/redact/compiler-runtime',
      'use-sync-external-store/shim/index.js': '@tanstack/redact',
    },
    tsconfigPaths: true,
  },
  server: {
    port: dashPort,
    strictPort: true,
    allowedHosts: localRoot
      ? [localDashHost, localRoot]
      : ['dash.groupher.localhost', 'groupher.localhost'],
    ws: {
      protocol: isDevelopment ? 'ws' : 'wss',
      host: localDashHost,
      clientPort: isDevelopment ? dashPort : 443,
      path: '__dash_hmr',
    },
    fs: {
      allow: [repoRoot],
    },
  },
  ssr: { noExternal: process.env.E2E_AUTH_STACK === '1' ? ['@groupher/tooltip'] : true },
  plugins: [
    ...(process.env.E2E_AUTH_STACK === '1'
      ? []
      : [cloudflare({ viteEnvironment: { name: 'ssr' }, types: { includeRuntime: false } })]),
    tanstackStart(),
    createVgpuWgslVitePlugin(),
    viteReact(),
    redact(),
    tailwindcss(),
  ],
})
