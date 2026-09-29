import { bindings, defineConfig } from 'cf/config'

export default defineConfig({
  worker: {
    name: 'inspire-me',
    compatibilityDate: '2026-07-28',
    compatibilityFlags: ['nodejs_compat'],
    entrypoint: '@tanstack/react-start/server-entry',
    workersDev: false,
    cache: { enabled: true },
    observability: {
      enabled: true,
      logs: { headSamplingRate: 1 },
      traces: { enabled: true, headSamplingRate: 0.01 },
    },
    assets: { notFoundHandling: 'none' },
    env: { ASSETS: bindings.assets() },
  },
})
