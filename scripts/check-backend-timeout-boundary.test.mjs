import assert from 'node:assert/strict'
import test from 'node:test'

import {
  infrastructureTimeoutOwners,
  scanBackendTimeoutBoundary,
  timeoutBoundaryFindings,
} from './check-backend-timeout-boundary.mjs'

test('rejects database execution controls passed through business code', () => {
  const source = `
    def page(first, after_cursor, timeout_ms) do
      Repo.all(query, timeout: timeout_ms)
    end
    defp transaction(_budget, fun), do: Repo.transaction(fun)
  `
  assert.equal(timeoutBoundaryFindings(source, 'groupher_server/cms/example/query.ex').length, 3)
})

test('keeps pagination and quoted or commented prose out of findings', () => {
  const source = `
    # timeout_ms belongs to the database adapter
    @doc "budget and timeout: are not code here"
    def page(first, after_cursor), do: Repo.all(query)
  `
  assert.deepEqual(timeoutBoundaryFindings(source, 'groupher_server/cms/example/query.ex'), [])
})

test('only exact classified infrastructure modules may own a timeout', () => {
  const allowed = 'groupher_server/cms/search_artiments/algolia.ex'
  assert.ok(infrastructureTimeoutOwners.get(allowed))
  assert.deepEqual(timeoutBoundaryFindings('timeout: @timeout', allowed), [])
  assert.equal(timeoutBoundaryFindings('timeout: @timeout', `${allowed}.new`).length, 1)
})

test('current backend has no unclassified timeout parameters', () => {
  assert.deepEqual(scanBackendTimeoutBoundary(), [])
})
