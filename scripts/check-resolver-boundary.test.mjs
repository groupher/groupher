import assert from 'node:assert/strict'
import test from 'node:test'

import { resolverBoundaryFindings } from './check-resolver-boundary.mjs'

test('rejects persistence and internal domain dependencies', () => {
  const source = `
    import Ecto.Query
    alias GroupherServer.Repo
    CMS.Articles.Store.find(id)
    CMS.Communities.Query.page(filter)
    Helper.ORM.find(User, id)
  `

  assert.equal(resolverBoundaryFindings(source).length, 5)
})

test('rejects persistence-shape mapping and partial schemas', () => {
  const source = `
    Map.from_struct(draft)
    CMS.Communities.set_category(community, %Category{id: category_id})
    CMS.Communities.members(:moderators, %Community{slug: slug}, filter)
  `

  assert.equal(resolverBoundaryFindings(source).length, 3)
})

test('accepts canonical middleware structs and public facades', () => {
  const source = `
    def run(_root, %{community: %Community{} = community}, _info) do
      CMS.Communities.paged_categories(%{community: community.slug})
    end
  `

  assert.deepEqual(resolverBoundaryFindings(source), [])
})
