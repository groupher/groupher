/**
 * Defines the Auth Worker routes, bindings, and Durable Object export.
 *
 * cf CLI -> Auth Worker -> OAuth and session endpoints
 */
import { bindings, defineConfig, exports as workerExports, triggers } from 'cf/config'

export default defineConfig({
  worker: {
    name: 'auth',
    compatibilityDate: '2026-07-31',
    compatibilityFlags: ['nodejs_compat'],
    entrypoint: 'src/worker.ts',
    workersDev: false,
    observability: {
      enabled: true,
      logs: { headSamplingRate: 1 },
      traces: { enabled: true, headSamplingRate: 0.01 },
    },
    triggers: [
      triggers.fetch({
        pattern: 'auth.groupher.com/*',
        zone: 'bd0b41b1b0c3775bd45228dda8567d93',
      }),
    ],
    env: {
      AUTH_URL: bindings.text('https://auth.groupher.com'),
      AUTH_COOKIE_DOMAIN: bindings.text('.groupher.com'),
      SERVICE_AUTH_ISSUER: bindings.text('https://auth.groupher.com'),
      SERVICE_AUTH_RESOURCES_JSON: bindings.text(
        '{"https://api.groupher.com/assets":"phoenix:assets-api","https://api.groupher.com/auth":"phoenix:auth-api","https://api.groupher.com/content-import":"phoenix:content-import-api","https://api.groupher.com/press":"phoenix:press-api","https://assets.groupher.com/internal":"assets-hub:internal-api","https://content-import.groupher.com/internal":"content-import:internal-api","https://press.groupher.com/internal":"press:internal-api"}',
      ),
      SERVICE_AUTH_TOKEN_TTL_SECONDS: bindings.text('600'),
      SERVICE_AUTH_TOKEN_ENDPOINT: bindings.text('https://auth.groupher.com/oauth2/token'),
      PHOENIX_GRAPHQL_ENDPOINT: bindings.text('https://api.groupher.com/graphiql'),
      NODE_ENV: bindings.text('production'),
      AUTH_GITHUB_ID: bindings.secret(),
      AUTH_GITHUB_SECRET: bindings.secret(),
      NEXTAUTH_SECRET: bindings.secret(),
      SERVICE_AUTH_CLIENTS_JSON: bindings.secret(),
      SERVICE_AUTH_CLIENT_ID: bindings.secret(),
      SERVICE_AUTH_CLIENT_SECRET: bindings.secret(),
      SERVICE_AUTH_SIGNING_JWK: bindings.secret(),
      LINK_INTENTS: bindings.durableObject({
        worker: 'auth',
        exportName: 'LinkIntentObject',
      }),
      AUTH_OAUTH_RATE_LIMITER: bindings.rateLimit({
        namespace: '9001003',
        simple: { limit: 30, period: 60 },
      }),
      AUTH_REFRESH_RATE_LIMITER: bindings.rateLimit({
        namespace: '9001001',
        simple: { limit: 10, period: 60 },
      }),
      SERVICE_TOKEN_RATE_LIMITER: bindings.rateLimit({
        namespace: '9001002',
        simple: { limit: 10, period: 60 },
      }),
    },
    exports: {
      LinkIntentObject: workerExports.durableObject({ storage: 'sqlite' }),
    },
  },
})
