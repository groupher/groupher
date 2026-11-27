import assert from 'node:assert/strict'
import test from 'node:test'

import { databaseTargetForEnvironment } from './database-ownership.ts'
import {
  ISOLATED_CORE_SERVICE_IDS,
  isolatedServiceDefinitions,
} from './isolated-service-definitions.ts'
import { createSpawnEnvironment } from './local-environment.ts'
import { SERVICE_DEFINITIONS } from './services.ts'

test('derives a sibling domain, independent service ports and the owned database', () => {
  const ports = Object.fromEntries(
    SERVICE_DEFINITIONS.filter((service) => service.port).map((service, index) => [
      service.id,
      12000 + index,
    ]),
  )
  const database = databaseTargetForEnvironment(
    { role: 'secondary', slug: 'feature-login', worktreeId: '0123456789abcdef' },
    'dev',
  )
  const result = isolatedServiceDefinitions(SERVICE_DEFINITIONS, 'feature-login', ports, database)
  const auth = result.find((service) => service.id === 'auth')!
  const phoenix = result.find((service) => service.id === 'phoenix')!
  const dash = result.find((service) => service.id === 'dash')!
  const gateway = result.find((service) => service.id === 'dev-gateway')!
  const community = result.find((service) => service.id === 'community')!
  const press = result.find((service) => service.id === 'press')!
  const assets = result.find((service) => service.id === 'assets-hub')!
  const status = result.find((service) => service.id === 'status')!
  assert.equal(auth.localEnvironment?.env?.AUTH_COOKIE_DOMAIN, '.groupher-feature-login.localhost')
  assert.equal(
    auth.localEnvironment?.env?.AUTH_URL,
    'https://auth.groupher-feature-login.localhost',
  )
  assert.equal(
    auth.localEnvironment?.env?.PHOENIX_GRAPHQL_ENDPOINT,
    `http://127.0.0.1:${ports.phoenix}/graphiql`,
  )
  assert.equal(phoenix.localEnvironment?.env?.DB_NAME, database.database)
  assert.equal(phoenix.localEnvironment?.env?.DB_POOL_SIZE, '10')
  assert.equal(press.localEnvironment?.env?.DB_NAME, database.database)
  assert.ok(!press.localEnvironment?.editableEnvKeys?.includes('DB_NAME'))
  assert.ok(!phoenix.localEnvironment?.externalEnvKeys?.includes('ALGOLIA_ADMIN_API_KEY'))
  const assetsEnvironment = createSpawnEnvironment(
    assets,
    { ASSETS_R2_ENDPOINT: 'https://production.example', ASSETS_R2_ACCESS_KEY_ID: 'secret' },
    { env: assets.localEnvironment!.env! },
  )
  assert.equal(assetsEnvironment.ASSETS_HUB_RUNTIME, 'local')
  assert.equal(assetsEnvironment.ASSETS_R2_ENDPOINT, '')
  assert.equal(assetsEnvironment.ASSETS_R2_ACCESS_KEY_ID, undefined)
  for (const service of result.filter((item) =>
    ['dev-gateway', 'auth', 'phoenix', 'community', 'dash', 'assets-hub'].includes(item.id),
  )) {
    for (const [key, value] of Object.entries(service.localEnvironment?.env || {})) {
      if (!/(?:ENDPOINT|_SITE|_URL|_ISSUER)$/.test(key) || !/^https?:\/\//.test(value)) continue
      const host = new URL(value).hostname
      assert.ok(
        host === '127.0.0.1' ||
          host === 'localhost' ||
          host.endsWith('.groupher-feature-login.localhost') ||
          host === 'groupher-feature-login.localhost',
        `${service.id}.${key} points outside its local environment`,
      )
    }
  }
  assert.equal(
    community.localEnvironment?.env?.SERVICE_AUTH_TOKEN_ENDPOINT,
    `http://127.0.0.1:${ports.auth}/oauth2/token`,
  )
  assert.equal(gateway.localEnvironment?.env?.COMMUNITY_SITE, `http://127.0.0.1:${ports.community}`)
  assert.equal(phoenix.localEnvironment?.env?.PORT, String(ports.phoenix))
  assert.equal(status.localEnvironment?.env?.PORT, String(ports.status))
  assert.equal(status.workerEnvFile, true)
  assert.ok(ISOLATED_CORE_SERVICE_IDS.has('status'))
  assert.equal(dash.portlessAppUrl, 'https://dash.groupher-feature-login.localhost/home/overview')
  assert.equal(
    SERVICE_DEFINITIONS.find((service) => service.id === 'auth')?.localEnvironment?.env
      ?.AUTH_COOKIE_DOMAIN,
    '.groupher.localhost',
  )
  assert.throws(() =>
    isolatedServiceDefinitions(SERVICE_DEFINITIONS, 'feature-login', {}, database),
  )
})
