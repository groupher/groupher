import { QueryClient, type InfiniteData } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { DEFAULT_EFFECTIVE_PAGI_CONFIG } from '~/lib/pagination/params'
import type { TCommentPage } from '~/query/commentPage'
import type { TComment } from '~/spec'

import { commentQueries } from '../../comment'
import { markChange, rollbackChanges } from '../optimistic/effects'
import { deleteCommentChanges, patchCommentEverywhere, insertPendingReplyChanges } from './cache'
import { mapCommentEntries, mapCommentPages, withPageEntries } from './pages'
const article = { community: 'home', thread: 'POST' as const, innerId: '1' }
const scope = { community: 'home', thread: 'POST' as const, articleInnerId: '1' }
const config = {
  ...DEFAULT_EFFECTIVE_PAGI_CONFIG,
  api: 'cursor' as const,
  mode: 'LOAD_MORE' as const,
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
    const changes = deleteCommentChanges(
      client,
      {
        scope,
        articlePath: article,
        articleKey: 'home:POST:1',
        commentInnerId: '11',
        commentPath: { article, innerId: '11' },
        comment: root.replies![0],
      },
      context(client),
    )
    for (const change of changes) markChange(client, change)
    for (const change of changes) change.commit()
    expect(client.getQueryData<InfiniteData<TCommentPage>>(repliesKey)!.pages[1].entries).toEqual(
      [],
    )
    rollbackChanges(client, changes)
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
    rollbackChanges(client, changes)
    expect(client.getQueryData<InfiniteData<TCommentPage>>(own)!.pages[0].entries).toEqual([
      root.replies![0],
    ])
    for (const change of changes) {
      markChange(client, change)
      change.commit()
    }
    expect(
      client.getQueryData<InfiniteData<TCommentPage>>(own)!.pages[0].entries.at(-1)?.innerId,
    ).toBe('pending:cmd')
    expect(
      client.getQueryData<InfiniteData<TCommentPage>>(main)!.pages[0].entries[0].replies.at(-1)
        .innerId,
    ).toBe('pending:cmd')
    expect(client.getQueryData<InfiniteData<TCommentPage>>(other)!.pages[0].entries).toEqual([])
    rollbackChanges(client, changes)
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
    const changes = deleteCommentChanges(
      client,
      {
        scope,
        articlePath: article,
        articleKey: 'home:POST:1',
        commentInnerId: '11',
        commentPath: { article, innerId: '11' },
        comment: parent,
      },
      context(client),
    )
    for (const change of changes) {
      markChange(client, change)
      change.commit()
    }
    expect(client.getQueryData<TCommentPage>(key)!.entries[0].replyToComment).toBeNull()
    rollbackChanges(client, changes)
    expect(client.getQueryData<TCommentPage>(key)!.entries.map((entry) => entry.innerId)).toEqual([
      '11',
      '12',
    ])
    expect(client.getQueryData<TCommentPage>(key)!.entries[1].replyToComment?.body?.html).toBe(
      'parent',
    )
  })

  it('restores a comment nested in a replyToComment chain', () => {
    const client = new QueryClient()
    const key = commentQueries.page(
      { article, mode: 'TIMELINE' },
      DEFAULT_EFFECTIVE_PAGI_CONFIG,
    ).queryKey
    const nested = { innerId: 'nested', replies: [] } as TComment
    const middle = { innerId: 'middle', replyToComment: nested } as TComment
    const top = { innerId: 'top', replyToComment: middle } as TComment
    client.setQueryData(key, page([top]))
    const changes = deleteCommentChanges(
      client,
      {
        scope,
        articlePath: article,
        articleKey: 'home:POST:1',
        commentInnerId: 'nested',
        commentPath: { article, innerId: 'nested' },
        comment: nested,
      },
      context(client),
    )

    expect(changes).toHaveLength(1)
    for (const change of changes) {
      markChange(client, change)
      change.commit()
    }
    expect(
      client.getQueryData<TCommentPage>(key)!.entries[0].replyToComment?.replyToComment,
    ).toBeNull()
    rollbackChanges(client, changes)
    expect(
      client.getQueryData<TCommentPage>(key)!.entries[0].replyToComment?.replyToComment?.innerId,
    ).toBe('nested')
  })

  it('restores a deleted comment by pageParam after an earlier page is removed', () => {
    const client = new QueryClient()
    const key = commentQueries.infinite({ article, mode: 'REPLIES' }, config).queryKey
    const deleted = { innerId: 'deleted', replies: [] } as TComment
    client.setQueryData(key, {
      pages: [page([{ innerId: 'earlier' } as TComment]), page([deleted])],
      pageParams: [undefined, 'deleted-page'],
    })
    const changes = deleteCommentChanges(
      client,
      {
        scope,
        articlePath: article,
        articleKey: 'home:POST:1',
        commentInnerId: 'deleted',
        commentPath: { article, innerId: 'deleted' },
        comment: deleted,
      },
      context(client),
    )
    for (const change of changes) markChange(client, change)
    for (const change of changes) change.commit()

    client.setQueryData(key, { pages: [page([])], pageParams: ['deleted-page'] })
    rollbackChanges(client, changes)

    expect(client.getQueryData<InfiniteData<TCommentPage>>(key)!.pages[0].entries).toEqual([
      deleted,
    ])
  })

  it('does not restore a deleted comment into a different surviving page', () => {
    const client = new QueryClient()
    const key = commentQueries.infinite({ article, mode: 'REPLIES' }, config).queryKey
    const deleted = { innerId: 'deleted', replies: [] } as TComment
    const other = { innerId: 'other', replies: [] } as TComment
    client.setQueryData(key, {
      pages: [page([deleted]), page([other])],
      pageParams: ['deleted-page', 'other-page'],
    })
    const changes = deleteCommentChanges(
      client,
      {
        scope,
        articlePath: article,
        articleKey: 'home:POST:1',
        commentInnerId: 'deleted',
        commentPath: { article, innerId: 'deleted' },
        comment: deleted,
      },
      context(client),
    )
    for (const change of changes) markChange(client, change)
    for (const change of changes) change.commit()

    client.setQueryData(key, { pages: [page([other])], pageParams: ['other-page'] })
    rollbackChanges(client, changes)

    expect(client.getQueryData<InfiniteData<TCommentPage>>(key)!.pages[0].entries).toEqual([other])
  })

  it('preserves query and untouched branch references when a page mapping makes no change', () => {
    const untouched = { ...root, innerId: 'untouched', replies: [] }
    const target = { ...root, innerId: 'target', replies: [] }
    const firstPage = page([untouched, target])
    const secondPage = page([{ ...root, innerId: 'later', replies: [] }])
    const data = { pages: [firstPage, secondPage], pageParams: [undefined, 'cursor'] }

    expect(mapCommentPages(data, (pageValue) => pageValue)).toBe(data)
    expect(mapCommentEntries(data, (entries) => entries)).toBe(data)
    const mapped = mapCommentEntries(data, (entries) => {
      const targetIndex = entries.findIndex(({ innerId }) => innerId === 'target')
      if (targetIndex < 0) return entries
      const nextEntries = [...entries]
      nextEntries[targetIndex] = { ...entries[targetIndex], body: { html: 'changed' } }
      return nextEntries
    }) as typeof data
    expect(mapped).not.toBe(data)
    expect(mapped.pages[0]).not.toBe(firstPage)
    expect(mapped.pages[0].entries[0]).toBe(untouched)
    expect(mapped.pages[1]).toBe(secondPage)
    expect(mapped.pageParams).toBe(data.pageParams)
  })

  it('preserves page identity when its entity arrays are unchanged', () => {
    const original = { entries: [root] }
    expect(withPageEntries(original, original.entries)).toBe(original)
  })

  it('prepares pending replies without mutating frozen cached data', () => {
    const client = new QueryClient()
    const key = commentQueries.infinite({ article, mode: 'TIMELINE' }, config).queryKey
    const data = {
      pages: [page([root])],
      pageParams: [undefined],
    }
    const freezeDeep = (value: unknown): void => {
      if (!value || typeof value !== 'object' || Object.isFrozen(value)) return
      for (const child of Object.values(value)) freezeDeep(child)
      Object.freeze(value)
    }
    freezeDeep(data)
    client.setQueryData(key, data)
    const before = client.getQueryData(key)

    const changes = insertPendingReplyChanges(
      client,
      {
        scope,
        articlePath: article,
        articleKey: 'home:POST:1',
        parentId: '10',
        parent: root,
        pending: { innerId: 'pending:readonly', rootInnerId: '10' } as TComment,
      },
      context(client),
    )

    rollbackChanges(client, changes)
    expect(client.getQueryData(key)).toBe(before)
    expect(client.getQueryData(key)).toEqual(data)
  })
})
