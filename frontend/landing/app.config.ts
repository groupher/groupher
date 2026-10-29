import { readFile, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { cloudflare } from '@cloudflare/vite-plugin'
import { createVgpuWgslVitePlugin } from '@groupher/frontend-core/vgpu-vite'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { redact } from '@tanstack/redact/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const landingRoot = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(landingRoot, '../..')
const landingPort = Number.parseInt(process.env.PORT || '3002', 10)
const isDevelopment = process.env.NODE_ENV !== 'production'

const landingPreviewAssetRewrite: Plugin = {
  name: 'landing-preview-asset-rewrite',
  enforce: 'pre',
  configurePreviewServer(server) {
    const outputRoot = path.join(landingRoot, '.cloudflare/output')
    const workerConfig = readdirSync(outputRoot, { recursive: true, withFileTypes: true }).find(
      (entry) => {
        if (!entry.isFile() || entry.name !== 'worker.config.json') return false

        const config = JSON.parse(
          readFileSync(path.join(entry.parentPath, entry.name), 'utf8'),
        ) as { name?: string; assets?: unknown }
        return config.name === 'landing' && config.assets !== undefined
      },
    )

    if (!workerConfig) throw new Error(`Landing preview assets were not found under ${outputRoot}`)

    const assetRoot = path.join(workerConfig.parentPath, 'assets', 'assets')

    server.middlewares.use((req, res, next) => {
      if (
        !req.url?.startsWith('/landing/assets/') ||
        (req.method !== 'GET' && req.method !== 'HEAD')
      ) {
        next()
        return
      }

      let assetPath: string
      try {
        const pathname = new URL(req.url, 'http://landing-preview').pathname
        assetPath = path.resolve(
          assetRoot,
          decodeURIComponent(pathname.slice('/landing/assets/'.length)),
        )
      } catch {
        res.statusCode = 400
        res.end()
        return
      }

      if (!assetPath.startsWith(`${assetRoot}${path.sep}`)) {
        res.statusCode = 400
        res.end()
        return
      }

      readFile(assetPath, (error, asset) => {
        if (error) {
          res.statusCode = error.code === 'ENOENT' ? 404 : 500
          res.end()
          return
        }

        res.statusCode = 200
        res.setHeader(
          'Content-Type',
          path.extname(assetPath) === '.css'
            ? 'text/css; charset=utf-8'
            : 'text/javascript; charset=utf-8',
        )
        res.setHeader('Content-Length', asset.byteLength)
        res.end(req.method === 'HEAD' ? undefined : asset)
      })
    })
  },
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/landing/' : '/',
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
  ssr: { noExternal: true },
  plugins: [
    landingPreviewAssetRewrite,
    cloudflare({
      assetsOnly: true,
      config:
        command === 'serve'
          ? {
              compatibilityFlags: ['nodejs_compat'],
              entrypoint: '@tanstack/react-start/server-entry',
            }
          : undefined,
      viteEnvironment: { name: 'ssr' },
      prerenderWorker: {
        config: {
          name: 'landing-prerender',
          compatibilityDate: '2026-08-06',
          compatibilityFlags: ['nodejs_compat'],
          entrypoint: '@tanstack/react-start/server-entry',
        },
        viteEnvironment: { name: 'ssr' },
      },
    }),
    tanstackStart({
      router: { basepath: '/' },
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
    createVgpuWgslVitePlugin(),
    viteReact(),
    redact(),
    tailwindcss(),
  ],
}))
