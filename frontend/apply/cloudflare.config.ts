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
      name: 'apply',
      compatibilityDate: '2026-08-06',
      compatibilityFlags: ['nodejs_compat'],
      entrypoint: '@tanstack/react-start/server-entry',
      workersDev: true,
      observability,
      domains: production ? ['apply.groupher.com'] : undefined,
      env: {
        GRAPHQL_ENDPOINT: bindings.text(
          production
            ? 'https://api.groupher.com/graphiql'
            : 'http://api.groupher.localhost:4001/graphiql',
        ),
      },
    },
  }
})
