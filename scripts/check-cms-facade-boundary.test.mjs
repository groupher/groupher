import assert from 'node:assert/strict'
import test from 'node:test'

import { commandManifestFindings, facadeBoundaryFindings } from './check-cms-facade-boundary.mjs'

test('rejects persistence, effects, and shared command construction in facades', () => {
  const source = `
    alias GroupherServer.Repo
    Repo.transaction(fn)
    Req.get(url)
    %CMS.Command{action: :update}
  `

  assert.equal(facadeBoundaryFindings(source).length, 5)
})

test('ignores historical boundary wording in moduledoc comments', () => {
  const source = `
    # Repo / external boundary
    def update(attrs), do: CMS.Articles.Commands.Update.execute(attrs)
  `

  assert.deepEqual(facadeBoundaryFindings(source), [])
})

test('requires the current Docs and Kanban concrete command manifest', () => {
  assert.deepEqual(commandManifestFindings(), [])
})
