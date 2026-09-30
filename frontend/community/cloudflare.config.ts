import { bindings, defineConfig } from 'cf/config'

const observability = {
  enabled: true,
  logs: { headSamplingRate: 1 },
  traces: { enabled: true, headSamplingRate: 0.01 },
} as const

export default defineConfig(({ mode }) => ({
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
        mode === 'production'
          ? 'https://api.groupher.com/graphiql'
          : 'http://api.groupher.localhost:4001/graphiql',
      ),
    },
  },
}))
