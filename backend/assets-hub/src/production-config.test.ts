import { afterEach, expect, it, vi } from 'vitest'

vi.mock('cf/config', () => ({
  bindings: {
    text: (value: string) => value,
    secret: () => 'secret-binding',
    r2: (value: unknown) => value,
    queue: (value: unknown) => value,
    durableObject: (value: unknown) => value,
  },
  defineConfig: (value: unknown) => value,
  exports: { durableObject: (value: unknown) => value },
  triggers: { queue: (value: unknown) => value },
}))

import config from '../cloudflare.config'

afterEach(() => vi.unstubAllEnvs())

it('keeps production Worker destinations when local values are inherited', () => {
  vi.stubEnv('PHOENIX_GRAPHQL_ENDPOINT', 'http://127.0.0.1:14001/graphiql')
  vi.stubEnv('SERVICE_AUTH_ISSUER', 'https://auth.groupher-feature.localhost')
  vi.stubEnv('SERVICE_AUTH_JWKS_URL', 'http://127.0.0.1:14004/.well-known/jwks.json')
  vi.stubEnv('SERVICE_AUTH_TOKEN_ENDPOINT', 'http://127.0.0.1:14004/oauth2/token')
  const worker = (
    config as unknown as (input: { mode: string }) => {
      worker: { env: Record<string, unknown> }
    }
  )({ mode: 'production' }).worker
  expect(worker.env.PHOENIX_GRAPHQL_ENDPOINT).toBe('https://api.groupher.com/graphiql')
  expect(worker.env.SERVICE_AUTH_ISSUER).toBe('https://auth.groupher.com')
  expect(worker.env.SERVICE_AUTH_JWKS_URL).toBe('https://auth.groupher.com/.well-known/jwks.json')
  expect(worker.env.SERVICE_AUTH_TOKEN_ENDPOINT).toBe('https://auth.groupher.com/oauth2/token')
  // This is the pre-existing deployed binding; its name does not prove isolation.
  expect(worker.env.ASSETS_BUCKET).toMatchObject({ name: 'groupher-assets-dev' })
})
