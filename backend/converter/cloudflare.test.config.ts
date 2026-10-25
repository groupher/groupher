/**
 * Converter Cloudflare runtime boundary.
 *
 * test config -> isolated workerd -> converter
 */
import { bindings, defineConfig } from 'cf/config'

export default defineConfig(() => ({
  worker: {
    name: 'converter-test',
    compatibilityDate: '2026-10-03',
    compatibilityFlags: ['nodejs_compat'],
    entrypoint: 'src/worker.ts',
    env: {
      ALLOWED_ORIGINS: bindings.text('https://example.test'),
      ENVIRONMENT: bindings.text('test'),
      MAX_UPLOAD_BYTES: bindings.text(String(25 * 1024 * 1024)),
    },
  },
}))
