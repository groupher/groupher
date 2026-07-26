import assert from 'node:assert/strict'
import test from 'node:test'

import { SERVICE_DEFINITIONS, SERVICE_RELATIONS } from './services.ts'

test('standalone services declare a four-item technology stack', () => {
  const standaloneServices = SERVICE_DEFINITIONS.filter(
    (service) => service.id !== 'comment-importer',
  )

  for (const service of standaloneServices) {
    assert.equal(service.technologies?.length, 4, service.name)
  }
})

test('frontend and Phoenix stacks match their runtime boundaries', () => {
  for (const id of ['main', 'dashboard', 'landing']) {
    const service = SERVICE_DEFINITIONS.find((definition) => definition.id === id)
    assert.deepEqual(service?.technologies, ['nextjs', 'react', 'typescript', 'tailwindcss'])
  }

  const gateway = SERVICE_DEFINITIONS.find((definition) => definition.id === 'gateway')
  assert.deepEqual(gateway?.technologies, ['hono', 'nodejs', 'typescript', 'routing'])
  assert.equal(gateway?.config?.kind, 'env-files')

  const auth = SERVICE_DEFINITIONS.find((definition) => definition.id === 'auth')
  assert.deepEqual(auth?.technologies, ['hono', 'authjs', 'typescript', 'oauth'])
  assert.equal(auth?.config?.kind, 'env-files')

  const phoenix = SERVICE_DEFINITIONS.find((definition) => definition.id === 'phoenix')
  assert.deepEqual(phoenix?.technologies, ['phoenix', 'elixir', 'absinthe', 'postgresql'])
})

test('frontend services keep the intended list order', () => {
  assert.deepEqual(
    SERVICE_DEFINITIONS.filter((definition) => definition.group === 'frontend').map(
      (definition) => definition.id,
    ),
    ['gateway', 'auth', 'landing', 'main', 'dashboard', 'inspire-me'],
  )
})

test('the not-yet-split comment importer keeps its monogram fallback', () => {
  const importer = SERVICE_DEFINITIONS.find((definition) => definition.id === 'comment-importer')

  assert.equal(importer?.monogram, 'CI')
  assert.equal(importer?.technologies, undefined)
})

test('service relations only reference declared services', () => {
  const serviceIds = new Set(SERVICE_DEFINITIONS.map((definition) => definition.id))

  for (const relation of SERVICE_RELATIONS) {
    assert.equal(serviceIds.has(relation.source), true, `${relation.id} source`)
    assert.equal(serviceIds.has(relation.target), true, `${relation.id} target`)
  }
})

test('the request flow documents gateway routing and GraphQL dependencies', () => {
  assert.deepEqual(
    SERVICE_RELATIONS.map(({ source, target, label }) => ({ source, target, label })),
    [
      { source: 'gateway', target: 'auth', label: '/api/auth/*' },
      { source: 'gateway', target: 'landing', label: '/, /pricing, /book-demo' },
      { source: 'auth', target: 'main', label: 'signed-in session' },
      { source: 'auth', target: 'dashboard', label: '/:community/dashboard/*' },
      { source: 'gateway', target: 'main', label: 'all other routes' },
      { source: 'main', target: 'phoenix', label: 'GraphQL' },
      { source: 'dashboard', target: 'phoenix', label: 'GraphQL' },
    ],
  )
})

test('only main and dashboard default to a configured start chain', () => {
  const startPolicies = Object.fromEntries(
    SERVICE_DEFINITIONS.map((definition) => [definition.id, definition.startPolicy]),
  )

  assert.deepEqual(startPolicies.main, {
    defaultMode: 'chain',
    requiredDependencies: ['gateway', 'auth', 'phoenix'],
    optionalDependencies: ['document-converter'],
  })
  assert.deepEqual(startPolicies.dashboard, startPolicies.main)

  for (const id of ['gateway', 'auth', 'landing', 'inspire-me', 'phoenix', 'document-converter']) {
    assert.equal(startPolicies[id], undefined, id)
  }
})

test('the managed gateway routes to local frontend ports', () => {
  const gateway = SERVICE_DEFINITIONS.find((definition) => definition.id === 'gateway')

  assert.deepEqual(
    {
      LANDING_SITE: gateway?.env?.LANDING_SITE,
      MAIN_SITE: gateway?.env?.MAIN_SITE,
      DASHBOARD_SITE: gateway?.env?.DASHBOARD_SITE,
      AUTH_SITE: gateway?.env?.AUTH_SITE,
    },
    {
      LANDING_SITE: 'http://127.0.0.1:3002',
      MAIN_SITE: 'http://127.0.0.1:3000',
      DASHBOARD_SITE: 'http://127.0.0.1:3001',
      AUTH_SITE: 'http://127.0.0.1:3004',
    },
  )
})

test('service configuration roots stay scoped to each runtime', () => {
  const configByService = Object.fromEntries(
    SERVICE_DEFINITIONS.map((definition) => [
      definition.id,
      definition.config
        ? {
            kind: definition.config.kind,
            root: definition.config.root.replaceAll('\\', '/'),
          }
        : null,
    ]),
  )

  assert.match(configByService.main?.root || '', /frontend\/main$/)
  assert.match(configByService.dashboard?.root || '', /frontend\/dashboard$/)
  assert.match(configByService.landing?.root || '', /frontend\/landing$/)
  assert.match(configByService.gateway?.root || '', /frontend\/gateway$/)
  assert.match(configByService.auth?.root || '', /frontend\/auth$/)
  assert.match(configByService['inspire-me']?.root || '', /local\/inspire-me$/)
  assert.equal(configByService.phoenix?.kind, 'elixir-config')
  assert.match(configByService.phoenix?.root || '', /backend\/main\/config$/)
  assert.match(configByService['document-converter']?.root || '', /services\/document-converter$/)
  assert.equal(configByService['comment-importer'], null)
})

test('managed services expose stable Portless names and keep the API under the cookie parent', () => {
  const namedServices = SERVICE_DEFINITIONS.filter((definition) => definition.port !== undefined)

  for (const service of namedServices) {
    assert.ok(service.portlessName, `${service.name} Portless name`)
    assert.equal(new URL(service.portlessUrl || '').hostname.endsWith('.localhost'), true)
  }

  const main = SERVICE_DEFINITIONS.find((definition) => definition.id === 'main')
  assert.equal(main?.portlessName, 'main')
  assert.equal(main?.portlessUrl, 'https://main.groupher.localhost/health')
  assert.equal(main?.portlessAppUrl, 'https://main.groupher.localhost/home')

  const dashboard = SERVICE_DEFINITIONS.find((definition) => definition.id === 'dashboard')
  assert.equal(dashboard?.portlessUrl, 'https://dashboard.groupher.localhost/health')
  assert.equal(dashboard?.portlessAppUrl, 'https://dashboard.groupher.localhost/home/dashboard')

  for (const id of ['auth', 'landing', 'dashboard', 'inspire-me', 'document-converter']) {
    const service = SERVICE_DEFINITIONS.find((definition) => definition.id === id)
    assert.equal(
      new URL(service?.portlessUrl || '').hostname.endsWith('.groupher.localhost'),
      true,
      id,
    )
  }

  const phoenix = SERVICE_DEFINITIONS.find((definition) => definition.id === 'phoenix')
  assert.equal(phoenix?.portlessName, 'api')
  assert.equal(phoenix?.portlessUrl, 'https://api.groupher.localhost/health')
})
