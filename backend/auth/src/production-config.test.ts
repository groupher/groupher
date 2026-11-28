// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('cf/config', () => ({
  bindings: {
    text: (value: string) => value,
    secret: () => 'secret-binding',
    durableObject: (value: unknown) => value,
    rateLimit: (value: unknown) => value,
  },
  defineConfig: (value: unknown) => value,
  exports: { durableObject: (value: unknown) => value },
  triggers: { fetch: (value: unknown) => value },
}))

import config from '../cloudflare.config'

afterEach(() => vi.unstubAllEnvs())

it('keeps production Auth Worker destinations when local values are inherited', () => {
  vi.stubEnv('AUTH_URL', 'https://auth.groupher-feature.localhost')
  vi.stubEnv('AUTH_COOKIE_DOMAIN', '.groupher-feature.localhost')
  vi.stubEnv('PHOENIX_GRAPHQL_ENDPOINT', 'http://127.0.0.1:14001/graphiql')
  vi.stubEnv('SERVICE_AUTH_ISSUER', 'https://auth.groupher-feature.localhost')
  const worker = (
    config as unknown as (input: { mode: string }) => {
      worker: { env: Record<string, unknown> }
    }
  )({ mode: 'production' }).worker
  expect(worker.env.AUTH_URL).toBe('https://auth.groupher.com')
  expect(worker.env.AUTH_COOKIE_DOMAIN).toBe('.groupher.com')
  expect(worker.env.PHOENIX_GRAPHQL_ENDPOINT).toBe('https://api.groupher.com/graphiql')
  expect(worker.env.SERVICE_AUTH_ISSUER).toBe('https://auth.groupher.com')
})
