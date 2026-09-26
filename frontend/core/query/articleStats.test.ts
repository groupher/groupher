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
  articleStats,
  cacheArticleStats,
  isArticleStatsSnapshotStale,
} from './articleStats'
import { articleKeys } from './key'

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
  reactionCounts: [{ type: 'HEART', count: 2 }],
  snapshotAt: new Date(NOW).toISOString(),
  ...overrides,
})

afterEach(() => vi.restoreAllMocks())

beforeEach(() => browserGraphQLRequest.mockReset())

describe('ArticleStats freshness and ordering', () => {
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

  it('rejects an older snapshot without replacing the entity', () => {
    const queryClient = new QueryClient()
    const key = articleKeys.stats('home', THREAD.POST, '42')
    const current = stats()
    queryClient.setQueryData(key, current)

    cacheArticleStats(queryClient, {
      ...current,
      snapshotAt: new Date(NOW - 1_000).toISOString(),
      views: 1,
    })

    expect(queryClient.getQueryData(key)).toEqual(current)
  })

  it('drops a newer mixed snapshot with a lower views revision', () => {
    const queryClient = new QueryClient()
    const key = articleKeys.stats('home', THREAD.POST, '42')
    const current = stats()
    queryClient.setQueryData(key, current)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    cacheArticleStats(queryClient, {
      ...current,
      snapshotAt: new Date(NOW + 1_000).toISOString(),
      viewsRevision: current.viewsRevision - 1,
      commentsCount: 99,
    })

    expect(queryClient.getQueryData(key)).toEqual(current)
    expect(warn).toHaveBeenCalledWith('[ArticleStats] mixed_snapshot', expect.any(Object))
  })

  it('drops a newer mixed snapshot when any owner revision regresses', () => {
    const queryClient = new QueryClient()
    const key = articleKeys.stats('home', THREAD.POST, '42')
    const current = stats()
    queryClient.setQueryData(key, current)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    cacheArticleStats(queryClient, {
      ...current,
      snapshotAt: new Date(NOW + 1_000).toISOString(),
      interactionRevision: current.interactionRevision - 1,
    })

    expect(queryClient.getQueryData(key)).toEqual(current)
    expect(warn).toHaveBeenCalledWith('[ArticleStats] mixed_snapshot', {
      currentSnapshotAt: current.snapshotAt,
      incomingSnapshotAt: new Date(NOW + 1_000).toISOString(),
      revision: 'interactionRevision',
      currentRevision: current.interactionRevision,
      incomingRevision: current.interactionRevision - 1,
    })
  })

  it('accepts a strictly advanced revision even when snapshotAt is invalid', () => {
    const queryClient = new QueryClient()
    const key = articleKeys.stats('home', THREAD.POST, '42')
    const current = stats()
    queryClient.setQueryData(key, current)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const incoming = {
      ...current,
      views: current.views + 1,
      viewsRevision: current.viewsRevision + 1,
      snapshotAt: 'invalid-but-non-authoritative',
    }
    cacheArticleStats(queryClient, incoming)

    expect(queryClient.getQueryData(key)).toEqual(incoming)
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
    expect(warn).toHaveBeenCalledWith('[ArticleStats] invalid_snapshot', {
      snapshotAt: incoming.snapshotAt,
    })
  })

  it('does not read the deleted public stats contracts', () => {
    const source = print(articleStatsDocument)

    expect(source).toContain('articleStats(')
    expect(source).not.toMatch(/articleViewSummaries|ArticleViewSummary|viewSummary|view-summary/)
  })

  it('does not turn a missing single-article response into an epoch zero snapshot', async () => {
    browserGraphQLRequest.mockResolvedValue({ articleStats: [] })

    await expect(
      articleStats('home', THREAD.POST, '42').queryFn({ signal: undefined }),
    ).rejects.toThrow('ArticleStats unavailable')
  })
})
