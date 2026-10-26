/**
 * Configures bindings and runtime settings for the Press Worker.
 *
 * Business position:
 *
 *   deployment mode
 *     -> Press Worker bindings
 *     -> Phoenix / Hyperdrive services
 */
import { bindings, defineConfig, triggers } from 'cf/config'

const localDatabaseUrl = process.env.DATABASE_URL || 'postgresql://press:press@127.0.0.1:5432/press'

export default defineConfig(({ mode }) => {
  if (mode === 'probe') {
    const id = process.env.PRESS_HYPERDRIVE_ID
    if (!id) throw new Error('PRESS_HYPERDRIVE_ID is required for the database probe')
    return {
      worker: {
        name: 'press-db-probe',
        compatibilityDate: '2026-10-03',
        compatibilityFlags: ['nodejs_compat'],
        entrypoint: 'src/db-probe.ts',
        workersDev: true,
        env: {
          HYPERDRIVE: bindings.hyperdrive({ id }),
          PROBE_TOKEN: bindings.secret(),
        },
      },
    }
  }

  const local = mode === 'development'
  const preview = mode === 'preview'
  if (preview && !process.env.PRESS_HYPERDRIVE_ID) {
    throw new Error('PRESS_HYPERDRIVE_ID is required for isolated Press preview')
  }
  const hyperdriveId = local
    ? 'local-hyperdrive'
    : process.env.PRESS_HYPERDRIVE_ID || '00000000-0000-0000-0000-000000000000'
  const setting = (name: string, productionFallback: string): string => {
    const configured = process.env[name]
    if (preview && !configured) throw new Error(`${name} is required for isolated Press preview`)
    return configured || productionFallback
  }

  return {
    worker: {
      name: local ? 'press-local' : preview ? 'press-preview' : 'press',
      compatibilityDate: '2026-10-03',
      // Auth/JWKS public endpoints may be Workers on this same Cloudflare zone.
      compatibilityFlags: local
        ? ['nodejs_compat']
        : ['nodejs_compat', 'global_fetch_strictly_public'],
      entrypoint: 'src/worker.ts',
      domains: local || mode === 'preview' ? undefined : ['press.groupher.com'],
      workersDev: local || preview,
      previewUrls: local ? undefined : true,
      observability: local
        ? undefined
        : {
            enabled: true,
            logs: { headSamplingRate: 1 },
            traces: { enabled: true, headSamplingRate: 0.01 },
          },
      triggers: local ? undefined : [triggers.scheduled({ schedule: '17 4 * * *' })],
      env: {
        HYPERDRIVE: bindings.hyperdrive({
          id: hyperdriveId,
          ...(local ? { dev: { connectionString: localDatabaseUrl } } : {}),
        }),
        PHOENIX_GRAPHQL_ENDPOINT: bindings.text(
          local
            ? process.env.PHOENIX_GRAPHQL_ENDPOINT || 'http://127.0.0.1:4001/graphiql'
            : setting('PHOENIX_GRAPHQL_ENDPOINT', 'https://api.groupher.com/graphiql'),
        ),
        PHOENIX_PRESS_RESOURCE: bindings.text(
          setting('PHOENIX_PRESS_RESOURCE', 'https://api.groupher.com/press'),
        ),
        SERVICE_AUTH_ISSUER: bindings.text(
          setting('SERVICE_AUTH_ISSUER', 'https://auth.groupher.com'),
        ),
        SERVICE_AUTH_JWKS_URL: bindings.text(
          setting('SERVICE_AUTH_JWKS_URL', 'https://auth.groupher.com/.well-known/jwks.json'),
        ),
        SERVICE_AUTH_TOKEN_ENDPOINT: bindings.text(
          setting('SERVICE_AUTH_TOKEN_ENDPOINT', 'https://auth.groupher.com/oauth2/token'),
        ),
        SERVICE_AUTH_CLIENT_ID: bindings.secret(),
        SERVICE_AUTH_CLIENT_SECRET: bindings.secret(),
        METRIC_IP_SALT: bindings.secret(),
        PRESS_PUBLIC_DISABLED: bindings.text(
          local ? 'false' : process.env.PRESS_PUBLIC_DISABLED || 'true',
        ),
        CF_VERSION_METADATA: bindings.versionMetadata(),
      },
    },
  }
})
