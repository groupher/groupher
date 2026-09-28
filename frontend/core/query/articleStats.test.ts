import { QueryClient } from '@tanstack/react-query'
import { print } from 'graphql'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { browserGraphQLRequest } = vi.hoisted(() => ({ browserGraphQLRequest: vi.fn() }))

vi.mock('~/graphql/client', () => ({ browserGraphQLRequest }))

import { THREAD } from '~/const/thread'
import { articleStats as articleStatsDocument } from '~/schemas/pages/articleStats'
import type { TArticleStats } from '~/spec'

import {
  ARTICLE_STATS_SNAPSHOT_MAX_AGE_MS,
  articleStatsCache,
  articleStats,
  articleStatsBatch,
  isArticleStatsSnapshotStale,
  mergeArticleStats,
} from './articleStats'
import { articleQueryKeys } from './key'

const NOW = Date.parse('2026-09-18T00:00:00.000Z')

const stats = (overrides: Partial<TArticleStats> = {}): TArticleStats => ({
  community: 'home',
  thread: THREAD.POST,
  innerId: '42',
  views: 10,
  viewsRevision: 2,
  upvotesCount: 3,
  commentsCount: 4,
  collectsCount: 5,
  commentsParticipantsCount: 6,
  interactionRevision: 7,
  commentsRevision: 8,
  emotionCounts: [{ type: 'HEART', count: 2 }],
  snapshotAt: new Date(NOW).toISOString(),
  ...overrides,
})

afterEach(() => vi.restoreAllMocks())

beforeEach(() => browserGraphQLRequest.mockReset())

describe('ArticleStats freshness and ordering', () => {
  it('matches only detail and batch queries containing the exact Article path', () => {
    const path = { community: 'home', thread: THREAD.POST, innerId: '42' }
    expect(
      articleStatsCache.contains(articleQueryKeys.stats('home', THREAD.POST, '42'), path),
    ).toBe(true)
    expect(
      articleStatsCache.contains(
        articleQueryKeys.statsBatch('home', THREAD.POST, ['41', '42']),
        path,
      ),
    ).toBe(true)
    expect(
      articleStatsCache.contains(articleQueryKeys.statsBatch('home', THREAD.POST, ['43']), path),
    ).toBe(false)
    expect(
      articleStatsCache.contains(articleQueryKeys.statsBatch('other', THREAD.POST, ['42']), path),
    ).toBe(false)
  })

  it('uses the shared snapshot max-age policy', () => {
    expect(ARTICLE_STATS_SNAPSHOT_MAX_AGE_MS).toBe(600_000)
    expect(isArticleStatsSnapshotStale(new Date(NOW - 599_999).toISOString(), NOW)).toBe(false)
    expect(isArticleStatsSnapshotStale(new Date(NOW - 600_000).toISOString(), NOW)).toBe(true)
  })

  it('handles client clocks ahead, behind, and invalid snapshotAt values', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(isArticleStatsSnapshotStale(new Date(NOW + 30_000).toISOString(), NOW)).toBe(false)
    expect(warn).toHaveBeenCalledWith('[ArticleStats] clock_skew', {
      snapshotAt: new Date(NOW + 30_000).toISOString(),
    })
    warn.mockClear()

    expect(isArticleStatsSnapshotStale(new Date(NOW - 30_000).toISOString(), NOW)).toBe(false)
    expect(warn).not.toHaveBeenCalled()
    expect(isArticleStatsSnapshotStale('not-a-date', NOW)).toBe(true)
  })

  it('keeps equal-revision owner data even when snapshotAt is older', () => {
    const queryClient = new QueryClient()
    const key = articleQueryKeys.stats('home', THREAD.POST, '42')
    const current = stats()
    queryClient.setQueryData(key, current)

    articleStatsCache.apply(queryClient, {
      ...current,
      snapshotAt: new Date(NOW - 1_000).toISOString(),
      views: 1,
    })

    expect(queryClient.getQueryData(key)).toEqual(current)
  })

  it('accepts a newer comments owner while keeping a regressed views owner', () => {
    const queryClient = new QueryClient()
    const key = articleQueryKeys.stats('home', THREAD.POST, '42')
    const current = stats()
    queryClient.setQueryData(key, current)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    articleStatsCache.apply(queryClient, {
      ...current,
      snapshotAt: new Date(NOW + 1_000).toISOString(),
      viewsRevision: current.viewsRevision - 1,
      commentsCount: 99,
      commentsRevision: current.commentsRevision + 1,
    })

    expect(queryClient.getQueryData<TArticleStats>(key)).toMatchObject({
      views: current.views,
      viewsRevision: current.viewsRevision,
      commentsCount: 99,
      commentsRevision: current.commentsRevision + 1,
    })
    expect(warn).not.toHaveBeenCalled()
  })

  it('keeps the current value for a regressed owner', () => {
    const queryClient = new QueryClient()
    const key = articleQueryKeys.stats('home', THREAD.POST, '42')
    const current = stats()
    queryClient.setQueryData(key, current)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    articleStatsCache.apply(queryClient, {
      ...current,
      snapshotAt: new Date(NOW + 1_000).toISOString(),
      interactionRevision: current.interactionRevision - 1,
    })

    expect(queryClient.getQueryData(key)).toEqual(current)
    expect(warn).not.toHaveBeenCalled()
  })

  it('accepts a strictly advanced revision even when snapshotAt is invalid', () => {
    const queryClient = new QueryClient()
    const key = articleQueryKeys.stats('home', THREAD.POST, '42')
    const current = stats()
    queryClient.setQueryData(key, current)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const incoming = {
      ...current,
      views: current.views + 1,
      viewsRevision: current.viewsRevision + 1,
      snapshotAt: 'invalid-but-non-authoritative',
    }
    articleStatsCache.apply(queryClient, incoming)

    expect(queryClient.getQueryData(key)).toEqual({
      ...incoming,
      snapshotAt: current.snapshotAt,
    })
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
    expect(warn).toHaveBeenCalledWith('[ArticleStats] invalid_snapshot', {
      snapshotAt: incoming.snapshotAt,
    })
  })

  it('patches existing detail and batch consumers without creating an entity cache', () => {
    const queryClient = new QueryClient()
    const detailKey = articleQueryKeys.stats('home', THREAD.POST, '42')
    const batchKey = articleQueryKeys.statsBatch('home', THREAD.POST, ['42', '7'])
    const current = stats()
    const other = stats({ innerId: '7', views: 4, viewsRevision: 1 })
    queryClient.setQueryData(detailKey, current)
    queryClient.setQueryData(batchKey, [current, other])
    const detailUpdatedAt = queryClient.getQueryState(detailKey)?.dataUpdatedAt
    const batchUpdatedAt = queryClient.getQueryState(batchKey)?.dataUpdatedAt

    articleStatsCache.apply(queryClient, stats({ views: 11, viewsRevision: 3 }))

    expect(queryClient.getQueryData<TArticleStats>(detailKey)?.views).toBe(11)
    expect(queryClient.getQueryData<TArticleStats[]>(batchKey)?.map((item) => item.views)).toEqual([
      11, 4,
    ])
    expect(queryClient.getQueryState(detailKey)?.dataUpdatedAt).toBe(detailUpdatedAt)
    expect(queryClient.getQueryState(batchKey)?.dataUpdatedAt).toBe(batchUpdatedAt)
  })

  it('does not fan out one locator result to a mirror in another community', () => {
    const queryClient = new QueryClient()
    const homeKey = articleQueryKeys.stats('home', THREAD.POST, '42')
    const mirrorKey = articleQueryKeys.stats('acme', THREAD.POST, '42')
    queryClient.setQueryData(homeKey, stats())
    queryClient.setQueryData(mirrorKey, stats({ community: 'acme' }))

    articleStatsCache.apply(queryClient, stats({ views: 11, viewsRevision: 3 }))

    expect(queryClient.getQueryData<TArticleStats>(homeKey)?.views).toBe(11)
    expect(queryClient.getQueryData<TArticleStats>(mirrorKey)?.views).toBe(10)
  })

  it('reports equal-revision owner conflicts and keeps the current owner', () => {
    const current = stats()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const merged = mergeArticleStats(current, { ...current, views: current.views + 1 })

    expect(merged.stats).toEqual(current)
    expect(merged.conflict).toBe(true)
    expect(warn).toHaveBeenCalledWith('[ArticleStats] owner_conflict', expect.any(Object))
  })

  it('marks a detail query stale after a network response has an owner conflict', async () => {
    const queryClient = new QueryClient()
    const key = articleQueryKeys.stats('home', THREAD.POST, '42')
    const current = stats()
    queryClient.setQueryData(key, current)
    browserGraphQLRequest.mockResolvedValue({
      articleStats: [{ ...current, views: current.views + 1 }],
    })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await queryClient.fetchQuery({
      ...articleStats(queryClient, 'home', THREAD.POST, '42'),
      staleTime: 0,
    })
    await Promise.resolve()

    expect(queryClient.getQueryData(key)).toEqual(current)
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
  })

  it('merges every owner independently in a batch network response', () => {
    const queryClient = new QueryClient()
    const current = stats()
    const options = articleStatsBatch(queryClient, 'home', THREAD.POST, ['42'])

    const merged = options.structuralSharing(
      [current],
      [
        {
          ...current,
          views: 1,
          viewsRevision: current.viewsRevision - 1,
          commentsCount: 99,
          commentsRevision: current.commentsRevision + 1,
        },
      ],
    )

    expect(merged[0]).toMatchObject({
      views: current.views,
      viewsRevision: current.viewsRevision,
      commentsCount: 99,
      commentsRevision: current.commentsRevision + 1,
    })
  })

  it('does not read the deleted public stats contracts', () => {
    const source = print(articleStatsDocument)

    expect(source).toContain('articleStats(')
    expect(source).not.toMatch(/articleViewSummaries|ArticleViewSummary|viewSummary|view-summary/)
  })

  it('does not turn a missing single-article response into an epoch zero snapshot', async () => {
    browserGraphQLRequest.mockResolvedValue({ articleStats: [] })
    const queryClient = new QueryClient()

    await expect(
      articleStats(queryClient, 'home', THREAD.POST, '42').queryFn({ signal: undefined }),
    ).rejects.toThrow('ArticleStats unavailable')
  })
})
