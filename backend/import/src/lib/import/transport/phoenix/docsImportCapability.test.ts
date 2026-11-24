import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { buildSchema, parse, validate } from 'graphql'
import { beforeEach, expect, it, vi } from 'vitest'

import { canImportDocs } from './docsImport'

const request = vi.hoisted(() => vi.fn())
vi.mock('../../../groupherGraphql', () => ({ requestGroupherGraphQL: request }))

beforeEach(() => request.mockReset())

it('checks the registered Phoenix import capability with a schema-valid document', async () => {
  request.mockResolvedValue({ canImportDocs: true })
  await expect(canImportDocs('home', { backendToken: 'test-token' })).resolves.toBe(true)
  const [query, variables] = request.mock.calls[0]
  const schema = buildSchema(readFileSync(resolve(process.cwd(), '../api/schema.graphql'), 'utf8'))
  expect(validate(schema, parse(query))).toEqual([])
  expect(variables).toEqual({ community: 'home' })
})

it('preserves a denied import capability', async () => {
  request.mockResolvedValue({ canImportDocs: false })
  await expect(canImportDocs('home', { backendToken: 'test-token' })).resolves.toBe(false)
})
