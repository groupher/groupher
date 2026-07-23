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

  const phoenix = SERVICE_DEFINITIONS.find((definition) => definition.id === 'phoenix')
  assert.deepEqual(phoenix?.technologies, ['phoenix', 'elixir', 'absinthe', 'postgresql'])
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
      { source: 'gateway', target: 'landing', label: '/, /pricing, /book-demo' },
      { source: 'gateway', target: 'dashboard', label: '/:community/dashboard/*' },
      { source: 'gateway', target: 'main', label: 'all other routes' },
      { source: 'main', target: 'phoenix', label: 'GraphQL' },
      { source: 'dashboard', target: 'phoenix', label: 'GraphQL' },
    ],
  )
})

test('the managed gateway routes to local frontend ports', () => {
  const gateway = SERVICE_DEFINITIONS.find((definition) => definition.id === 'gateway')

  assert.deepEqual(
    {
      LANDING_SITE: gateway?.env?.LANDING_SITE,
      MAIN_SITE: gateway?.env?.MAIN_SITE,
      DASHBOARD_SITE: gateway?.env?.DASHBOARD_SITE,
    },
    {
      LANDING_SITE: 'http://localhost:3002',
      MAIN_SITE: 'http://localhost:3000',
      DASHBOARD_SITE: 'http://localhost:3001',
    },
  )
})
