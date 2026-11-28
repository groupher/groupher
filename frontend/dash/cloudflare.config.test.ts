import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('cf/config', () => ({
  bindings: { text: (value: string) => value, secret: () => 'secret-binding' },
  defineConfig: (value: unknown) => value,
}))

import config from './cloudflare.config'

type TConfig = (args: { mode: string }) => { worker: { env: Record<string, string> } }

describe('Dashboard Worker bindings', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('uses managed development endpoints without changing production endpoints', () => {
    vi.stubEnv('GRAPHQL_ENDPOINT', 'http://127.0.0.1:14001/graphiql')
    vi.stubEnv('IMPORT_APP_ENDPOINT', 'http://127.0.0.1:18001')
    vi.stubEnv('SERVICE_AUTH_ISSUER', 'https://auth.groupher-feature.localhost')
    vi.stubEnv('SERVICE_AUTH_JWKS_URL', 'http://127.0.0.1:13004/.well-known/jwks.json')
    vi.stubEnv('SERVICE_AUTH_TOKEN_ENDPOINT', 'http://127.0.0.1:13004/oauth2/token')
    const factory = config as unknown as TConfig
    const development = factory({ mode: 'development' }).worker.env
    expect(development.GRAPHQL_ENDPOINT).toBe('http://127.0.0.1:14001/graphiql')
    expect(development.IMPORT_APP_ENDPOINT).toBe('http://127.0.0.1:18001')
    expect(development.SERVICE_AUTH_ISSUER).toBe('https://auth.groupher-feature.localhost')
    expect(development.SERVICE_AUTH_TOKEN_ENDPOINT).toBe('http://127.0.0.1:13004/oauth2/token')
    const production = factory({ mode: 'production' }).worker.env
    expect(production.GRAPHQL_ENDPOINT).toBe('https://api.groupher.com/graphiql')
    expect(production.IMPORT_APP_ENDPOINT).toBe('https://import.groupher.com')
    expect(production.SERVICE_AUTH_ISSUER).toBe('https://auth.groupher.com')
  })
})
