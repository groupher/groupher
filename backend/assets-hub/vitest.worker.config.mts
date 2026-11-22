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
      config: './cloudflare.test.config.ts',
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
    // Cloudflare's workerd sandbox cannot read Vitest 5's host-side transformed
    // module cache. Keep the Worker pool self-contained and deterministic.
    fsModuleCache: false,
    include: ['src/**/*.worker.test.ts', 'src/worker.test.ts'],
  },
})
