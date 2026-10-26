import test from 'node:test'
import assert from 'node:assert/strict'
import { resourceLookupFindings } from './check-cms-query-boundary.mjs'

test('rejects deleted top-level lookup definitions in domain Query modules', () => {
  const findings = resourceLookupFindings(
    'backend/api/lib/groupher_server/cms/articles/query.ex',
    'def article(id), do: Repo.get(Article, id)\n'
  )

  assert.equal(findings.length, 1)
  assert.match(findings[0], /forbidden resource lookup definition article/)
})

test('rejects each removed single-resource lookup declaration', () => {
  const cases = [
    ['articles/query.ex', 'article'],
    ['articles/query.ex', 'community'],
    ['articles/query.ex', 'branch_community'],
    ['articles/query.ex', 'binding'],
    ['articles/query.ex', 'pinned_binding'],
    ['communities/query.ex', 'get'],
    ['comments/query.ex', 'comment'],
  ]

  for (const [file, method] of cases) {
    const sourcePath = `backend/api/lib/groupher_server/cms/${file}`
    const findings = resourceLookupFindings(sourcePath, `def ${method}(id), do: Repo.get(Resource, id)\n`)
    assert.equal(findings.length, 1, `${sourcePath} must reject ${method}/1`)
  }
})

test('rejects direct and aliased calls to a removed resource lookup', () => {
  const findings = resourceLookupFindings(
    'backend/api/lib/groupher_server/cms/comments/commands/create.ex',
    `alias GroupherServer.CMS.Articles.Query, as: ArticleQuery
     ArticleQuery.article(id)
     CMS.Articles.Query.article(id)`
  )

  assert.equal(findings.length, 2)
  assert.ok(findings.every((finding) => finding.includes('forbidden')))
})

test('allows collection Query calls and non-owner functions with the same name', () => {
  const findings = resourceLookupFindings(
    'backend/api/lib/groupher_server/cms/communities/commands/support.ex',
    `alias CMS.Communities.Query, as: CommunityQuery
     CommunityQuery.page(filter, pagi)
     CMS.Communities.Categories.Query.get(id)`
  )

  assert.deepEqual(findings, [])
})

test('allows named Facts, Docs branch context, and canonical FrontDesk loads', () => {
  const findings = resourceLookupFindings(
    'backend/api/lib/groupher_server/cms/articles/commands/publish.ex',
    `alias CMS.Docs.Store
     alias GroupherServer.FrontDesk
     Store.branch_context(branch_id)
     FrontDesk.article(article_id, mode: :internal)`
  )

  assert.deepEqual(findings, [])
})
