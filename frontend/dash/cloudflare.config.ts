import { bindings, defineConfig } from 'cf/config'

const observability = {
  enabled: true,
  logs: { headSamplingRate: 1 },
  traces: { enabled: true, headSamplingRate: 0.01 },
} as const

export default defineConfig(({ mode }) => {
  const production = mode === 'production'

  return {
    worker: {
      name: 'dash',
      compatibilityDate: '2026-08-06',
      compatibilityFlags: ['nodejs_compat'],
      entrypoint: '@tanstack/react-start/server-entry',
      workersDev: true,
      observability,
      domains: ['dash.groupher.com'],
      env: {
        CONTENT_IMPORT_APP_ENDPOINT: bindings.text(
          production ? 'https://content-import.groupher.com' : 'http://127.0.0.1:8001',
        ),
        GRAPHQL_ENDPOINT: bindings.text(
          production
            ? 'https://api.groupher.com/graphiql'
            : 'http://api.groupher.localhost:4001/graphiql',
        ),
        SERVICE_AUTH_CLIENT_ID: bindings.text(production ? 'dash-production' : 'dash-development'),
        SERVICE_AUTH_ISSUER: bindings.text(
          production ? 'https://auth.groupher.com' : 'http://127.0.0.1:3004',
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
      },
    },
  }
})
