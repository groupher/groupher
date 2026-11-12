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
      name: 'community',
      compatibilityDate: '2026-08-06',
      compatibilityFlags: ['nodejs_compat'],
      entrypoint: '@tanstack/react-start/server-entry',
      workersDev: true,
      observability,
      domains: ['community.groupher.com'],
      env: {
        GRAPHQL_ENDPOINT: bindings.text(
          production
            ? 'https://api.groupher.com/graphql'
            : 'http://api.groupher.localhost:4001/graphql',
        ),
        SERVICE_AUTH_CLIENT_ID: bindings.text(
          production ? 'community-production' : 'community-development',
        ),
        SERVICE_AUTH_CLIENT_SECRET: bindings.secret(),
        SERVICE_AUTH_TOKEN_ENDPOINT: bindings.text(
          production
            ? 'https://auth.groupher.com/oauth2/token'
            : 'http://127.0.0.1:3004/oauth2/token',
        ),
      },
    },
  }
})
