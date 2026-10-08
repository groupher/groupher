import assert from 'node:assert/strict'
import test from 'node:test'

import { hasDirectPersistCall, isPersistFile } from './check-command-identity.mjs'

test('scans every CMS persist filename, including BindingPersist', () => {
  assert.equal(isPersistFile('backend/api/lib/groupher_server/cms/articles/binding_persist.ex'), true)
  assert.equal(isPersistFile('backend/api/lib/groupher_server/cms/pin_persist.ex'), true)
  assert.equal(isPersistFile('backend/api/lib/groupher_server/cms/content_import/persistence/job.ex'), false)
})

test('detects bare and aliased Persist calls in executable source', () => {
  assert.equal(hasDirectPersistCall('alias CMS.Dashboard.Persist\nPersist.update_section(dashboard, args)'), true)
  assert.equal(hasDirectPersistCall('alias CMS.Dashboard.Persist, as: Storage\nStorage.update_section(dashboard, args)'), true)
  assert.equal(hasDirectPersistCall('alias CMS.Dashboard.{Persist, Effects}\nPersist.update_section(dashboard, args)'), true)
  assert.equal(hasDirectPersistCall('CMS.Dashboard.Persist.update_section(dashboard, args)'), true)
})

test('ignores Persist wording in Elixir docs and comments', () => {
  const source = `
    @moduledoc """
    Persist.update_section is forbidden from a public facade.
    """
    # Persist.update_section(dashboard, args)
    def update(dashboard, args), do: {:ok, {dashboard, args}}
  `

  assert.equal(hasDirectPersistCall(source), false)
})
