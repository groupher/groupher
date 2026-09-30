/**
 * Defines Assets Hub Worker resources for local development and production deploys.
 *
 * cf CLI -> mode-specific bindings -> Assets Hub Worker
 */
import { bindings, defineConfig, exports as workerExports, triggers } from 'cf/config'

const observability = {
  enabled: true,
  logs: { headSamplingRate: 1 },
  traces: { enabled: true, headSamplingRate: 0.01 },
} as const

export default defineConfig(({ mode }) => {
  const production = mode === 'production'
  const name = production ? 'assets-hub' : 'assets-hub-dev'

  return {
    worker: {
      name,
      compatibilityDate: '2026-07-28',
      compatibilityFlags: ['nodejs_compat'],
      entrypoint: 'src/worker.ts',
      workersDev: true,
      observability,
      triggers: [
        triggers.queue({
          name: 'groupher-asset-delete-dev',
          maxBatchSize: 10,
          maxBatchTimeout: 5,
          maxRetries: 5,
        }),
      ],
      env: {
        ASSETS_PUBLIC_ENDPOINT: bindings.text(
          production ? 'https://assets.groupher.com' : 'https://assets.groupher.localhost',
        ),
        ASSETS_HUB_BATCH_ENDPOINT: bindings.text(
          production ? 'https://assets.groupher.com' : 'https://assets.groupher.localhost',
        ),
        ENVIRONMENT: bindings.text(production ? 'production' : 'development'),
        PHOENIX_GRAPHQL_ENDPOINT: bindings.text(
          production ? 'https://api.groupher.com/graphiql' : 'http://127.0.0.1:4001/graphiql',
        ),
        SERVICE_AUTH_ISSUER: bindings.text(
          production ? 'https://auth.groupher.com' : 'https://auth.groupher.localhost',
        ),
        SERVICE_AUTH_JWKS_URL: bindings.text(
          production
            ? 'https://auth.groupher.com/.well-known/jwks.json'
            : 'http://127.0.0.1:3004/.well-known/jwks.json',
        ),
        SERVICE_AUTH_TOKEN_ENDPOINT: bindings.text(
          production
            ? 'https://auth.groupher.com/oauth2/token'
            : 'http://127.0.0.1:3004/oauth2/token',
        ),
        ASSETS_HUB_CAPABILITY_SECRET: bindings.secret(),
        SERVICE_AUTH_CLIENT_ID: bindings.secret(),
        SERVICE_AUTH_CLIENT_SECRET: bindings.secret(),
        ASSETS_BUCKET: bindings.r2({
          name: 'groupher-assets-dev',
          dev: { remote: true },
        }),
        ASSET_DELETE_QUEUE: bindings.queue({ name: 'groupher-asset-delete-dev' }),
        GENERATED_IMAGE_BATCHES: bindings.durableObject({
          worker: name,
          exportName: 'GeneratedImageBatchDO',
        }),
      },
      exports: {
        GeneratedImageBatchDO: workerExports.durableObject({ storage: 'sqlite' }),
      },
    },
  }
})
