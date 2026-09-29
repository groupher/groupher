/**
 * Runs generated Batch integration tests inside the Cloudflare Workers runtime.
 *
 * Vitest
 *   -> Cloudflare pool
 *   -> workerd with cf test bindings
 *   -> generated Batch integration tests
 */
import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    cloudflareTest({
      experimental: {
        newConfig: { configPath: './cloudflare.test.config.ts' },
      },
      // The Vitest plugin reads the binding from newConfig, but it does not yet
      // instantiate the referenced Durable Object service for the test runtime.
      miniflare: {
        durableObjects: {
          GENERATED_IMAGE_BATCHES: {
            className: 'GeneratedImageBatchDO',
            useSQLite: true,
          },
        },
      },
    }),
  ],
  test: {
    include: ['src/**/*.worker.test.ts', 'src/worker.test.ts'],
  },
})
