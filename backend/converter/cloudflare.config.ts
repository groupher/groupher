/**
 * Converter Cloudflare runtime boundary.
 *
 * mode -> Worker bindings -> deployment
 */
import { bindings, defineConfig } from 'cf/config'

const observability = {
  enabled: true,
  logs: { headSamplingRate: 1 },
  traces: { enabled: true, headSamplingRate: 0.01 },
} as const

export default defineConfig(({ mode }) => {
  const production = mode === 'production'
  if (mode !== 'production' && mode !== 'development') {
    throw new Error('Converter supports only development and production modes.')
  }

  return {
    worker: {
      name: 'converter',
      compatibilityDate: '2026-10-03',
      compatibilityFlags: ['nodejs_compat'],
      entrypoint: 'src/worker.ts',
      workersDev: true,
      observability,
      ...(production ? { domains: ['converter.groupher.com'] } : {}),
      env: {
        ALLOWED_ORIGINS: bindings.text(''),
        ENVIRONMENT: bindings.text(production ? 'production' : 'development'),
        MAX_UPLOAD_BYTES: bindings.text(String(25 * 1024 * 1024)),
      },
    },
  }
})
