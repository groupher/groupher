import { defineConfig } from 'cf/config'

export default defineConfig({
  worker: {
    name: 'landing',
    compatibilityDate: '2026-08-06',
    workersDev: false,
    previewUrls: true,
    observability: {
      enabled: true,
      logs: { headSamplingRate: 1 },
      traces: { enabled: true, headSamplingRate: 0.01 },
    },
    assets: {
      htmlHandling: 'auto-trailing-slash',
      notFoundHandling: '404-page',
    },
  },
})
