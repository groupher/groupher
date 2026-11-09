import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { dsbKeys } from '~/query'
import { commentQueries } from '~/query/comment'
import type { TParseDashboard } from '~/spec'
const { loadComments, refresh } = vi.hoisted(() => ({ loadComments: vi.fn(), refresh: vi.fn() }))
vi.mock('../server/community', () => ({ loadComments }))
vi.mock('./articleSurface', () => ({
  isPaginationRevisionMismatch: (error: unknown) =>
    (error as { revision?: boolean })?.revision === true,
  refreshArticleBootstrap: refresh,
}))
import { prefetchComments } from './commentSurface'
const article = { community: 'home', thread: 'POST' as const, innerId: '1' }
const cursor = {
  api: 'cursor' as const,
  mode: 'load_more' as const,
  schemaVersion: 1,
  revision: 2,
  defaultSize: 20,
  maxSize: 30,
}
const result = {
  entries: [],
  pinnedEntries: [],
  pageInfo: { __typename: 'CursorPageInfo', api: 'cursor', endCursor: null, hasNextPage: false },
}

describe('SSR comments Pagi', () => {
  it('hydrates the exact browser infinite key selected by bootstrap', async () => {
    const client = new QueryClient()
    client.setQueryData(dsbKeys.config('home'), {
      pagiMode: cursor.mode,
      pagiRevision: cursor.revision,
    } as TParseDashboard)
    loadComments.mockResolvedValue(result)
    await prefetchComments(client, 'home', 'POST', '1')
    const options = commentQueries.infinite({ article, mode: 'REPLIES' }, cursor)
    expect(client.getQueryData(options.queryKey)).toEqual({
      pages: [result],
      pageParams: [undefined],
    })
    expect(loadComments.mock.lastCall?.[0].data.pagi).toEqual({
      cursor: { first: 20, configRevision: 2 },
    })
  })
  it('prefetches an explicit offset link even when bootstrap defaults to cursor', async () => {
    const client = new QueryClient()
    client.setQueryData(dsbKeys.config('home'), {
      pagiMode: cursor.mode,
      pagiRevision: cursor.revision,
    } as TParseDashboard)
    loadComments.mockResolvedValue(result)
    await prefetchComments(client, 'home', 'POST', '1', '?commentsApi=offset&commentsPage=4')
    const config = { ...cursor, api: 'offset' as const, mode: 'page' as const }
    expect(
      client.getQueryData(commentQueries.page({ article, mode: 'REPLIES' }, config, 4).queryKey),
    ).toEqual(result)
    expect(loadComments.mock.lastCall?.[0].data.pagi).toEqual({
      offset: { page: 4, size: 20, configRevision: 2 },
    })
  })
})

it('refreshes bootstrap once on revision mismatch and retains an explicit cursor location', async () => {
  const client = new QueryClient()
  client.setQueryData(dsbKeys.config('home'), {
    pagiMode: cursor.mode,
    pagiRevision: cursor.revision,
  } as TParseDashboard)
  loadComments.mockRejectedValueOnce({ revision: true }).mockResolvedValueOnce(result)
  refresh.mockImplementation(async () =>
    client.setQueryData(dsbKeys.config('home'), {
      pagiMode: cursor.mode,
      pagiRevision: 3,
    }),
  )
  await prefetchComments(client, 'home', 'POST', '1', '?commentsApi=cursor&commentsAfter=opaque')
  expect(refresh).toHaveBeenCalledOnce()
  expect(loadComments).toHaveBeenCalledTimes(2)
  expect(loadComments.mock.lastCall?.[0].data.pagi.cursor).toEqual({
    first: 20,
    after: 'opaque',
    configRevision: 3,
  })
})
it('stops after a second revision error and never retries an unrelated failure', async () => {
  const client = new QueryClient()
  loadComments.mockRejectedValue({ revision: true })
  refresh.mockResolvedValue(undefined)
  await expect(prefetchComments(client, 'home', 'POST', '1')).rejects.toEqual({ revision: true })
  expect(refresh).toHaveBeenCalledOnce()
  expect(loadComments).toHaveBeenCalledTimes(2)
  refresh.mockClear()
  loadComments.mockClear()
  const failure = new Error('unrelated')
  loadComments.mockRejectedValue(failure)
  await expect(prefetchComments(client, 'home', 'POST', '2')).rejects.toBe(failure)
  expect(refresh).not.toHaveBeenCalled()
  expect(loadComments).toHaveBeenCalledOnce()
})

it('does not fail the route when comment prefetch targets a hidden article', async () => {
  loadComments.mockRejectedValue({ errors: [{ extensions: { code: 6008 } }] })
  await expect(
    prefetchComments(new QueryClient(), 'home', 'CHANGELOG', '3'),
  ).resolves.toBeUndefined()
  expect(loadComments).toHaveBeenCalledOnce()
})

const testViewportWidth = window.innerWidth
beforeEach(() => Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 }))
afterEach(() =>
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: testViewportWidth }),
)

it('uses the mobile preference for a phone or tablet entry', async () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 768 })
  const client = new QueryClient()
  client.setQueryData(dsbKeys.config('home'), {
    pagiMode: 'page',
    pagiMobileMode: 'infinite_scroll',
    pagiRevision: 2,
  })
  loadComments.mockResolvedValue(result)
  await prefetchComments(client, 'home', 'POST', '1')
  expect(loadComments.mock.lastCall?.[0].data.pagi).toEqual({
    cursor: { first: 20, configRevision: 2 },
  })
})

it('does not prefetch an assumed desktop list when SSR lacks a viewport', async () => {
  vi.stubGlobal('window', undefined)
  try {
    await prefetchComments(new QueryClient(), 'home', 'POST', '1')
    expect(loadComments).not.toHaveBeenCalled()
  } finally {
    vi.unstubAllGlobals()
  }
})

it('keeps cursor links for client resolution when SSR has no viewport', async () => {
  vi.stubGlobal('window', undefined)
  try {
    await prefetchComments(
      new QueryClient(),
      'home',
      'POST',
      '1',
      '?commentsApi=cursor&commentsAfter=opaque',
    )
    expect(loadComments).not.toHaveBeenCalled()
  } finally {
    vi.unstubAllGlobals()
  }
})

it('still prefetches saved offset links without an SSR viewport', async () => {
  vi.stubGlobal('window', undefined)
  loadComments.mockResolvedValue(result)
  try {
    await prefetchComments(new QueryClient(), 'home', 'POST', '1', '?commentsPage=4')
    expect(loadComments.mock.lastCall?.[0].data.pagi).toMatchObject({
      offset: { page: 4, size: 20 },
    })
  } finally {
    vi.unstubAllGlobals()
  }
})
