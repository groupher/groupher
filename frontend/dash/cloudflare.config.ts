import { bindings, defineConfig } from 'cf/config'

const observability = {
  enabled: true,
  logs: { headSamplingRate: 1 },
  traces: { enabled: true, headSamplingRate: 0.01 },
} as const

export default defineConfig(({ mode }) => {
  const production = mode === 'production'
  if (mode !== 'production' && mode !== 'development') {
    throw new Error('Dashboard supports only development and production modes.')
  }

  return {
    worker: {
      name: production ? 'dash' : 'dash-dev',
      compatibilityDate: '2026-08-06',
      compatibilityFlags: ['nodejs_compat'],
      entrypoint: '@tanstack/react-start/server-entry',
      workersDev: true,
      observability,
      ...(production ? { domains: ['dash.groupher.com'] } : {}),
      env: {
        CONTENT_IMPORT_APP_ENDPOINT: bindings.text(
          production ? 'https://import.groupher.com' : 'http://127.0.0.1:8001',
        ),
        GRAPHQL_ENDPOINT: production
          ? bindings.text('https://api.groupher.com/graphiql')
          : bindings.text('http://api.groupher.localhost:4001/graphiql'),
        CONTENT_IMPORT_SERVICE_AUTH_RESOURCE: bindings.text('https://import.groupher.com/internal'),
        CONTENT_IMPORT_SERVICE_AUTH_SCOPES: bindings.text('docs:import:proxy'),
        SERVICE_AUTH_CLIENT_ID: bindings.text(
          production ? 'dash-cloudflare-91f1107ab3' : 'dash-development',
        ),
        SERVICE_AUTH_CLIENT_SECRET: bindings.secret(),
        SERVICE_AUTH_ISSUER: production
          ? bindings.text('https://auth.groupher.com')
          : bindings.text('http://127.0.0.1:3004'),
        SERVICE_AUTH_JWKS_URL: production
          ? bindings.text('https://auth.groupher.com/.well-known/jwks.json')
          : bindings.text('http://127.0.0.1:3004/.well-known/jwks.json'),
        SERVICE_AUTH_TOKEN_ENDPOINT: production
          ? bindings.text('https://auth.groupher.com/oauth2/token')
          : bindings.text('http://127.0.0.1:3004/oauth2/token'),
      },
    },
  }
})
