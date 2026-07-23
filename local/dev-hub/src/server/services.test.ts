import assert from 'node:assert/strict'
import test from 'node:test'

import { SERVICE_DEFINITIONS } from './services.ts'

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
