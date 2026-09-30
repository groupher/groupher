/**
 * Defines the isolated Cloudflare resources used by Assets Hub Worker tests.
 *
 * Vitest -> Cloudflare test pool -> test Worker bindings
 */
import { bindings, defineConfig, exports as workerExports } from 'cf/config'

export default defineConfig({
  worker: {
    name: 'assets-hub-test',
    compatibilityDate: '2026-07-28',
    compatibilityFlags: ['nodejs_compat'],
    entrypoint: 'src/worker.ts',
    env: {
      ASSETS_BUCKET: bindings.r2({ name: 'assets-hub-test' }),
      GENERATED_IMAGE_BATCHES: bindings.durableObject({
        worker: 'assets-hub-test',
        exportName: 'GeneratedImageBatchDO',
      }),
      ASSET_DELETE_QUEUE: bindings.queue({ name: 'assets-hub-test-delete' }),
    },
    exports: {
      GeneratedImageBatchDO: workerExports.durableObject({ storage: 'sqlite' }),
    },
  },
})
