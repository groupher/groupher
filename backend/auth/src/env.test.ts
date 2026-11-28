// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { expect, it } from 'vitest'

import { loadAuthEnvironment, resolvePhoenixGraphqlEndpoint } from './env'

it('does not load local dotenv values into production or managed Auth', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groupher-auth-env-'))
  try {
    await writeFile(path.join(root, '.env.local'), 'AUTH_URL=https://auth.groupher.localhost\n')
    const production: Record<string, string | undefined> = { NODE_ENV: 'production' }
    const managed: Record<string, string | undefined> = { DEV_HUB_MANAGED_ENVIRONMENT: 'true' }
    const local: Record<string, string | undefined> = {}
    loadAuthEnvironment(production, root)
    loadAuthEnvironment(managed, root)
    loadAuthEnvironment(local, root)
    expect(production.AUTH_URL).toBeUndefined()
    expect(managed.AUTH_URL).toBeUndefined()
    expect(local.AUTH_URL).toBe('https://auth.groupher.localhost')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('uses the production Phoenix endpoint and rejects inherited local configuration', () => {
  expect(resolvePhoenixGraphqlEndpoint({ NODE_ENV: 'production' })).toBe(
    'https://api.groupher.com/graphiql',
  )
  expect(resolvePhoenixGraphqlEndpoint({ NODE_ENV: 'development' })).toBe(
    'http://127.0.0.1:4001/graphiql',
  )
  for (const [key, value] of Object.entries({
    AUTH_URL: 'https://auth.groupher-feature.localhost',
    AUTH_COOKIE_DOMAIN: '.groupher-feature.localhost',
    PHOENIX_GRAPHQL_ENDPOINT: 'http://127.0.0.1:14001/graphiql',
    SERVICE_AUTH_ISSUER: 'https://auth.groupher-feature.localhost',
    SERVICE_AUTH_JWKS_URL: 'http://[::1]:14004/.well-known/jwks.json',
    SERVICE_AUTH_TOKEN_ENDPOINT: 'http://127.0.0.1:14004/oauth2/token',
    E2E_AUTH_STACK: '1',
  })) {
    expect(() => loadAuthEnvironment({ NODE_ENV: 'production', [key]: value }, '/unused')).toThrow(
      key,
    )
  }
})

it('rejects production mode loaded from a development dotenv file', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groupher-auth-env-'))
  try {
    await writeFile(path.join(root, '.env.local'), 'NODE_ENV=production\n')
    expect(() => loadAuthEnvironment({}, root)).toThrow('must be supplied by the process')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
