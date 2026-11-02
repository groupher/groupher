import assert from 'node:assert/strict'
import test from 'node:test'

import { namingFindings } from './check-article-binding-naming.mjs'

test('flags legacy ArticleCommunity storage and runtime names', () => {
  const files = ['backend/api/lib/groupher_server/cms/example.ex']
  const source = 'alias CMS.Model.ArticleCommunity\nfield :article_community_id\nschema "article_communities"'

  assert.deepEqual(
    namingFindings(files, () => source).map(({ message }) => message),
    [
      'legacy ArticleCommunity module name',
      'legacy article_community_id field',
      'legacy article_communities storage name',
    ],
  )
})

test('ignores migration history and accepts canonical binding names', () => {
  const files = [
    'backend/api/priv/repo/migrations/20200101000000_old.exs',
    'backend/api/lib/groupher_server/cms/articles/bindings.ex',
  ]

  const sources = {
    [files[0]]: 'schema "article_communities"',
    [files[1]]: 'alias CMS.Model.ArticleBinding\nBindings.get(article, community)',
  }

  assert.deepEqual(namingFindings(files, (file) => sources[file]), [])
})

test('keeps TicketSource and Ticket workflow relations outside ArticleBinding terminology', () => {
  const files = [
    'backend/api/lib/groupher_server/cms/tickets/model/source.ex',
    'backend/api/lib/groupher_server/cms/tickets.ex',
    'backend/api/lib/groupher_server/cms/model/ticket_case_member.ex',
    'backend/api/lib/groupher_server/cms/articles/bindings.ex',
  ]
  const sources = {
    [files[0]]: 'Stores a TicketSource relation.',
    [files[1]]: '@doc "Unlinks a source relation by its TicketSource identity."',
    [files[2]]: 'relation belongs to a Case Ticket.',
    [files[3]]: 'ArticleBinding relation terminology is forbidden.',
  }

  assert.deepEqual(
    namingFindings(files, (file) => sources[file]).map(({ file, message }) => ({ file, message })),
    [{ file: files[3], message: 'ArticleBinding relation terminology' }],
  )
})
