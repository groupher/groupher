import { resolve } from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import { type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

const widgetRoot = import.meta.dirname

const publicLoaderDuringDevelopment = (): Plugin => ({
  name: 'groupher-widget-public-loader',
  configureServer(server) {
    server.middlewares.use('/v1.js', (_request, response) => {
      response.statusCode = 200
      response.setHeader('Content-Type', 'text/javascript; charset=utf-8')
      response.end(`
        ;(function () {
          var script = document.currentScript
          var runtimeBaseUrl = script && script.src
            ? new URL('.', script.src).href
            : window.location.href
          window.__groupherWidgetRuntimeBaseUrl = runtimeBaseUrl
          var api = window.GroupherWidget = window.GroupherWidget || function () {
            ;(window.GroupherWidget.q = window.GroupherWidget.q || []).push(arguments)
          }
          if (script && script.dataset.widgetKey) {
            api('boot', {
              widgetKey: script.dataset.widgetKey,
              position: script.dataset.position,
              mock: script.dataset.mock,
            })
          }
          import(new URL('src/loader/index.ts', runtimeBaseUrl).href).catch(function (error) {
            console.error('[Groupher Widget] Unable to load the development loader.', error)
          })
        })()
      `)
    })
  },
})

const wireRuntimeAssetIntoLoader = (): Plugin => ({
  name: 'groupher-widget-runtime-asset',
  generateBundle(_options, bundle) {
    const chunks = Object.values(bundle).filter((output) => output.type === 'chunk')
    const loader = chunks.find((chunk) => chunk.name === 'loader')
    const runtime = chunks.find((chunk) => chunk.name === 'runtime')
    if (!loader || !runtime) throw new Error('Widget loader and runtime chunks are required.')

    loader.code = loader.code.replace('assets/widget-runtime.00000000.js', runtime.fileName)
  },
})

export default defineConfig(({ command }) => ({
  root: widgetRoot,
  server: {
    cors: true,
  },
  define: {
    __WIDGET_RUNTIME_ASSET_PATH__: JSON.stringify(
      command === 'serve' ? '/src/main.ts' : 'assets/widget-runtime.00000000.js',
    ),
  },
  plugins: [publicLoaderDuringDevelopment(), tailwindcss(), wireRuntimeAssetIntoLoader()],
  build: {
    emptyOutDir: true,
    manifest: true,
    outDir: resolve(widgetRoot, 'dist'),
    rollupOptions: {
      input: {
        demo: resolve(widgetRoot, 'demo/index.html'),
        loader: resolve(widgetRoot, 'src/loader/index.ts'),
        runtime: resolve(widgetRoot, 'src/main.ts'),
      },
      output: {
        assetFileNames: 'assets/[name].[hash:8][extname]',
        chunkFileNames: 'assets/[name].[hash:8].js',
        entryFileNames: (chunk) => {
          if (chunk.name === 'loader') return 'v1.js'
          if (chunk.name === 'runtime') return 'assets/widget-runtime.[hash:8].js'
          return 'assets/[name].[hash:8].js'
        },
      },
    },
    sourcemap: true,
    target: 'es2022',
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
}))
