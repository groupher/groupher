import { QueryClient, type InfiniteData } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { DEFAULT_EFFECTIVE_PAGI_CONFIG } from '~/lib/pagination/params'
import type { TCommentPage } from '~/query/commentPage'
import type { TComment } from '~/spec'

import { commentQueries } from '../../comment'
import { patchCommentChanges, patchCommentEverywhere, insertPendingReplyChanges } from './cache'
const article = { community: 'home', thread: 'POST' as const, innerId: '1' }
const scope = { community: 'home', thread: 'POST' as const, articleInnerId: '1' }
const config = {
  ...DEFAULT_EFFECTIVE_PAGI_CONFIG,
  api: 'cursor' as const,
  mode: 'load_more' as const,
}
const root = {
  innerId: '10',
  rootInnerId: '10',
  replies: [{ innerId: '11', body: { html: 'old' } }],
} as TComment
const info = { api: 'cursor', __typename: 'CursorPageInfo', hasNextPage: false }
const page = (entries: TComment[], pinnedEntries: TComment[] = []) => ({
  entries,
  pinnedEntries,
  pageInfo: info,
})
const context = (queryClient: QueryClient) => ({
  queryClient,
  accountScope: 'alice',
  commandId: 'cmd',
})

describe('comment page cache ownership', () => {
  it('updates finite, pinned, preview and infinite reply pages and rolls back only the deleted entity', () => {
    const client = new QueryClient()
    const mainKey = commentQueries.page(
      { article, mode: 'REPLIES' },
      DEFAULT_EFFECTIVE_PAGI_CONFIG,
    ).queryKey
    const repliesKey = commentQueries.infinite(
      { article, mode: 'REPLIES', rootInnerId: '10' },
      config,
    ).queryKey
    client.setQueryData(mainKey, page([], [root]))
    client.setQueryData(repliesKey, {
      pages: [page([]), page([root.replies![0]])],
      pageParams: [undefined, 'cursor'],
    })
    patchCommentEverywhere(client, scope, '11', (comment) => ({
      ...comment,
      body: { html: 'updated' },
    }))
    expect(
      client.getQueryData<TCommentPage>(mainKey)!.pinnedEntries[0].replies?.[0].body?.html,
    ).toBe('updated')
    expect(
      client.getQueryData<InfiniteData<TCommentPage>>(repliesKey)!.pages[1].entries[0].body?.html,
    ).toBe('updated')
    const changes = patchCommentChanges(
      client,
      {
        scope,
        articlePath: article,
        articleKey: 'home:POST:1',
        commentInnerId: '11',
        commentPath: { article, innerId: '11' },
        comment: root.replies![0],
      },
      'innerId',
      () => null,
      context(client),
    )
    expect(client.getQueryData<InfiniteData<TCommentPage>>(repliesKey)!.pages[1].entries).toEqual(
      [],
    )
    for (const change of changes) change.restore()
    expect(
      client.getQueryData<InfiniteData<TCommentPage>>(repliesKey)!.pages[1].entries[0].innerId,
    ).toBe('11')
    expect(client.getQueryData<InfiniteData<TCommentPage>>(repliesKey)!.pageParams).toEqual([
      undefined,
      'cursor',
    ])
  })
  it('a deep pending reply belongs to its root preview, timeline and matching reply collection', () => {
    const client = new QueryClient()
    const main = commentQueries.infinite({ article, mode: 'REPLIES' }, config).queryKey
    const own = commentQueries.infinite(
      { article, mode: 'REPLIES', rootInnerId: '10' },
      config,
    ).queryKey
    const other = commentQueries.infinite(
      { article, mode: 'REPLIES', rootInnerId: '20' },
      config,
    ).queryKey
    client.setQueryData(main, { pages: [page([root])], pageParams: [undefined] })
    client.setQueryData(own, { pages: [page([root.replies![0]])], pageParams: [undefined] })
    client.setQueryData(other, { pages: [page([])], pageParams: [undefined] })
    const changes = insertPendingReplyChanges(
      client,
      {
        scope,
        articlePath: article,
        articleKey: 'home:POST:1',
        parentId: '11',
        parent: { innerId: '11', rootInnerId: '10' },
        pending: { innerId: 'pending:cmd', rootInnerId: '10' },
      },
      context(client),
    )
    expect(
      client.getQueryData<InfiniteData<TCommentPage>>(own)!.pages[0].entries.at(-1)?.innerId,
    ).toBe('pending:cmd')
    expect(
      client.getQueryData<InfiniteData<TCommentPage>>(main)!.pages[0].entries[0].replies.at(-1)
        .innerId,
    ).toBe('pending:cmd')
    expect(client.getQueryData<InfiniteData<TCommentPage>>(other)!.pages[0].entries).toEqual([])
    for (const change of changes) change.restore()
    expect(client.getQueryData<InfiniteData<TCommentPage>>(own)!.pages[0].entries).toHaveLength(1)
    expect(
      client.getQueryData<InfiniteData<TCommentPage>>(main)!.pages[0].entries[0].replies,
    ).toHaveLength(1)
  })
  it('restores deleted reply target context as well as the list entity on rollback', () => {
    const client = new QueryClient()
    const key = commentQueries.page(
      { article, mode: 'TIMELINE' },
      DEFAULT_EFFECTIVE_PAGI_CONFIG,
    ).queryKey
    const parent = { innerId: '11', body: { html: 'parent' } } as TComment
    client.setQueryData(key, page([parent, { innerId: '12', replyToComment: parent }]))
    const changes = patchCommentChanges(
      client,
      {
        scope,
        articlePath: article,
        articleKey: 'home:POST:1',
        commentInnerId: '11',
        commentPath: { article, innerId: '11' },
        comment: parent,
      },
      'innerId',
      () => null,
      context(client),
    )
    expect(client.getQueryData<TCommentPage>(key)!.entries[0].replyToComment).toBeNull()
    for (const change of changes) change.restore()
    expect(client.getQueryData<TCommentPage>(key)!.entries.map((entry) => entry.innerId)).toEqual([
      '11',
      '12',
    ])
    expect(client.getQueryData<TCommentPage>(key)!.entries[1].replyToComment?.body?.html).toBe(
      'parent',
    )
  })
})
