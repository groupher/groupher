'use client'

import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'

import { Q } from '~/query'
import { articleRefKey, articleRefOf, type TArticleRef } from '~/query/articleRef'
import { isArticleStatsSnapshotStale } from '~/query/articleStats'
import { invalidate, QueryInvalidation } from '~/query/invalidation'
import { overlayArticleUpvoteReceiptOnViewerState } from '~/query/mutation/articleReceipt'
import useArticleInteractionReconcile from '~/query/useArticleInteractionReconcile'
import { clearArticleViewAck, readArticleViewAck } from '~/query/viewAck'
import type { TArticle, TArticleStats, TArticleViewerState } from '~/spec'
import { getAccountRef } from '~/stores/account/accountRef'
import useAccount from '~/stores/account/hooks'

export type TArticleState<T extends TArticle = TArticle> = {
  article: T
  stats: TArticleStats | null
  viewerState: TArticleViewerState
}

type TStatsBatch = {
  community: string
  thread: TArticleRef['thread']
  innerIds: string[]
}

const EMPTY_ARTICLES: readonly TArticle[] = []

const validRef = (ref: TArticleRef): boolean => Boolean(ref.community && ref.thread && ref.innerId)

const groupStatsBatches = (refs: readonly TArticleRef[]): TStatsBatch[] => {
  const groups = new Map<string, TStatsBatch>()

  for (const ref of refs) {
    const scope = `${ref.community}:${ref.thread}`
    const group = groups.get(scope) || {
      community: ref.community,
      thread: ref.thread,
      innerIds: [],
    }
    if (!group.innerIds.includes(String(ref.innerId))) group.innerIds.push(String(ref.innerId))
    groups.set(scope, group)
  }

  return [...groups.values()].map((group) => ({
    ...group,
    innerIds: group.innerIds.sort(),
  }))
}

/** Composes public stats, private viewer state, and confirmed local acknowledgements. */
export default function useArticleStates<T extends TArticle>(
  articles: readonly T[] | undefined,
): TArticleState<T>[] {
  const account = useAccount()
  const queryClient = useQueryClient()
  const refreshedStats = useRef(new Set<string>())
  const normalizedArticles = articles || (EMPTY_ARTICLES as readonly T[])
  const refs = useMemo(
    () => normalizedArticles.map(articleRefOf).filter(validRef),
    [normalizedArticles],
  )
  const batches = useMemo(() => groupStatsBatches(refs), [refs])
  const accountRef = account.accountRef || getAccountRef(account.user) || ''

  const batchQueries = useQueries({
    queries: batches.map(({ community, thread, innerIds }) =>
      Q.article.statsBatch(community, thread, innerIds),
    ),
  })
  const entityQueries = useQueries({
    queries: refs.map(({ community, thread, innerId }) => ({
      ...Q.article.stats(community, thread, innerId),
      enabled: false,
    })),
  })
  const viewerQuery = useQuery(Q.viewer.articleStates(accountRef, refs))
  const interactionQuery = useQuery(Q.viewer.articleInteractionStates(accountRef, refs))

  useArticleInteractionReconcile(normalizedArticles)

  const statsByRef = useMemo(() => {
    const index = new Map<string, TArticleStats>()
    for (const query of batchQueries) {
      for (const stats of query.data || []) index.set(articleRefKey(stats), stats)
    }
    for (const query of entityQueries) {
      if (query.data) index.set(articleRefKey(query.data), query.data)
    }
    return index
  }, [batchQueries, entityQueries])

  useEffect(() => {
    for (const ref of refs) {
      const key = articleRefKey(ref)
      const stats = statsByRef.get(key)
      if (
        !stats ||
        refreshedStats.current.has(key) ||
        !isArticleStatsSnapshotStale(stats.snapshotAt)
      ) {
        continue
      }
      refreshedStats.current.add(key)
      void invalidate(queryClient, QueryInvalidation.article.stats(ref))
    }
  }, [queryClient, refs, statsByRef])

  useEffect(() => {
    for (const ref of refs) {
      const key = articleRefKey(ref)
      if (viewerQuery.data?.[key]?.viewerHasViewed === true) clearArticleViewAck(key)
    }
  }, [refs, viewerQuery.data])

  return useMemo(
    () =>
      normalizedArticles.map((article) => {
        const ref = articleRefOf(article)
        const key = articleRefKey(ref)
        const stats = statsByRef.get(key) || null
        const base: TArticleViewerState = {
          articleKey: key,
          ...viewerQuery.data?.[key],
          ...interactionQuery.data?.[key],
        }
        const viewed = readArticleViewAck(key) ? { ...base, viewerHasViewed: true } : base

        return {
          article,
          stats,
          viewerState: overlayArticleUpvoteReceiptOnViewerState(accountRef, stats, viewed, key),
        }
      }),
    [accountRef, interactionQuery.data, normalizedArticles, statsByRef, viewerQuery.data],
  )
}
