import { describe, expect, it, vi } from 'vitest'

const { browserGraphQLRequest } = vi.hoisted(() => ({ browserGraphQLRequest: vi.fn() }))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest }))

import { CONFIRMED_COMMENT_RECEIPT_MAX_REFS } from '~/constant/cache'

import { commentQueries } from './comment'

describe('commentQueries.reconcile', () => {
  it('reconciles a bounded set of Comment refs in one request', async () => {
    browserGraphQLRequest.mockClear()
    const controller = new AbortController()
    browserGraphQLRequest.mockResolvedValue({
      commentReconcileStates: {
        article: { innerId: 7, commentsRevision: 4 },
        entries: [
          { commentInnerId: '1', comment: { innerId: '1', body: 'confirmed' } },
          { commentInnerId: '2', comment: null },
        ],
      },
    })

    const options = commentQueries.reconcile('home', 'POST', '7', ['2', '1', '1'])
    const result = await options.queryFn?.({ signal: controller.signal } as never)

    expect(browserGraphQLRequest).toHaveBeenCalledOnce()
    expect(browserGraphQLRequest.mock.calls[0][1]).toEqual({
      article: { community: 'home', thread: 'POST', innerId: '7' },
      commentInnerIds: ['1', '2'],
    })
    expect(browserGraphQLRequest.mock.calls[0][2]).toEqual({ signal: controller.signal })
    expect(result).toEqual({
      article: { innerId: 7, commentsRevision: 4 },
      comments: { '1': { innerId: '1', body: 'confirmed' }, '2': null },
    })
  })

  it('caps the reconcile contract at 100 unique refs', () => {
    const refs = Array.from({ length: CONFIRMED_COMMENT_RECEIPT_MAX_REFS + 1 }, (_, index) =>
      String(index + 1),
    )
    const options = commentQueries.reconcile('home', 'POST', '7', refs)

    expect(options.queryKey.at(-1)).toHaveLength(CONFIRMED_COMMENT_RECEIPT_MAX_REFS)
  })
})

import { DEFAULT_EFFECTIVE_PAGI_CONFIG } from '~/lib/pagination/params'

import { commentPageKey } from './comment'
const collection = {
  article: { community: 'home', thread: 'POST' as const, innerId: '7' },
  mode: 'REPLIES' as const,
}
const offsetConfig = DEFAULT_EFFECTIVE_PAGI_CONFIG
const cursorConfig = { ...offsetConfig, api: 'cursor' as const, mode: 'load_more' as const }
const offsetInfo = {
  __typename: 'OffsetPageInfo',
  page: 1,
  size: 20,
  totalCount: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
}

describe('comment Pagi collections', () => {
  it('uses the new root page document and separates pinned entries from the counted page', async () => {
    browserGraphQLRequest.mockClear()
    const controller = new AbortController()
    browserGraphQLRequest.mockResolvedValue({
      commentPage: {
        entries: [{ innerId: '1' }],
        pinnedEntries: [{ innerId: '2' }],
        pageInfo: offsetInfo,
      },
    })
    const result = await commentQueries
      .page(collection, offsetConfig)
      .queryFn?.({ signal: controller.signal } as never)
    expect(browserGraphQLRequest.mock.lastCall?.[1]).toEqual({
      article: collection.article,
      mode: 'REPLIES',
      filter: { sort: 'ASC_INSERTED' },
      pagi: { offset: { page: 1, size: offsetConfig.defaultSize, configRevision: 0 } },
    })
    expect(browserGraphQLRequest.mock.lastCall?.[2]).toEqual({ signal: controller.signal })
    expect(result).toMatchObject({
      entries: [{ innerId: '1' }],
      pinnedEntries: [{ innerId: '2' }],
      pageInfo: { api: 'offset', totalCount: 1 },
    })
    expect(result).not.toHaveProperty('totalCount')
  })
  it('binds reply cursors to a root and passes the opaque continuation unchanged', async () => {
    browserGraphQLRequest.mockClear()
    const controller = new AbortController()
    const reply = { ...collection, rootInnerId: '11' }
    browserGraphQLRequest.mockResolvedValue({
      commentReplyPage: {
        entries: [],
        pageInfo: {
          __typename: 'CursorPageInfo',
          endCursor: 'next',
          startCursor: 'start',
          hasNextPage: true,
          hasPreviousPage: false,
        },
      },
    })
    const options = commentQueries.infinite(reply, cursorConfig)
    const result = await options.queryFn?.({
      pageParam: 'opaque',
      signal: controller.signal,
    } as never)
    expect(browserGraphQLRequest.mock.lastCall?.[1]).toEqual({
      comment: { article: collection.article, innerId: '11' },
      filter: { sort: 'ASC_INSERTED' },
      pagi: { cursor: { first: cursorConfig.defaultSize, after: 'opaque', configRevision: 0 } },
    })
    expect(browserGraphQLRequest.mock.lastCall?.[2]).toEqual({ signal: controller.signal })
    expect(result).toMatchObject({
      pageInfo: { api: 'cursor', endCursor: 'next' },
      pinnedEntries: [],
    })
    expect(options.getNextPageParam?.(result!, [] as never, undefined, [] as never)).toBe('next')
    expect(commentPageKey(reply, cursorConfig)).not.toEqual(
      commentPageKey({ ...reply, rootInnerId: '12' }, cursorConfig),
    )
    expect(commentPageKey(reply, cursorConfig)).not.toEqual(commentPageKey(reply, offsetConfig))
    expect(commentPageKey(reply, cursorConfig)).not.toEqual(
      commentPageKey({ ...reply, article: { ...reply.article, innerId: '8' } }, cursorConfig),
    )
  })
})

import { resolveCommentPosition } from './commentPage'
it('explicit offset/cursor links survive default changes and keep positions outside config revision', () => {
  const offsetLink = new URLSearchParams('commentsApi=offset&commentsPage=4')
  expect(resolveCommentPosition(cursorConfig, offsetLink)).toMatchObject({
    config: { api: 'offset', mode: 'page' },
    page: 4,
  })
  const cursorLink = new URLSearchParams('commentsApi=cursor&commentsAfter=opaque')
  const position = resolveCommentPosition({ ...offsetConfig, revision: 8 }, cursorLink)
  expect(position).toMatchObject({
    config: { api: 'cursor', mode: 'load_more', revision: 8 },
    initialAfter: 'opaque',
  })
  expect(
    commentQueries.infinite({ ...collection, initialAfter: position.initialAfter }, position.config)
      .initialPageParam,
  ).toBe('opaque')
})
