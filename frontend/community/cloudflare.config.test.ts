import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('cf/config', () => ({
  bindings: { text: (value: string) => value, secret: () => 'secret-binding' },
  defineConfig: (value: unknown) => value,
}))

import config from './cloudflare.config'

type TConfig = (args: { mode: string }) => { worker: { env: Record<string, string> } }

describe('Community Worker bindings', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('uses the managed development services and keeps production destinations', () => {
    vi.stubEnv('GRAPHQL_ENDPOINT', 'http://127.0.0.1:14001/graphiql')
    vi.stubEnv('SERVICE_AUTH_TOKEN_ENDPOINT', 'http://127.0.0.1:13004/oauth2/token')
    const factory = config as unknown as TConfig
    const development = factory({ mode: 'development' }).worker.env
    expect(development.GRAPHQL_ENDPOINT).toBe('http://127.0.0.1:14001/graphiql')
    expect(development.SERVICE_AUTH_TOKEN_ENDPOINT).toBe('http://127.0.0.1:13004/oauth2/token')
    const production = factory({ mode: 'production' }).worker.env
    expect(production.GRAPHQL_ENDPOINT).toBe('https://api.groupher.com/graphiql')
    expect(production.SERVICE_AUTH_TOKEN_ENDPOINT).toBe('https://auth.groupher.com/oauth2/token')
  })
})
