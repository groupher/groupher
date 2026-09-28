/**
 * Builds normalized Article states for list, changelog, and Kanban surfaces.
 *
 *   Article contents
 *     -> group paths by community/thread
 *     -> real ArticleStats batch queries
 *     -> shared private-state/reconciliation layer
 *     -> ordered TArticleState[]
 *
 * Batch grouping is transport-only: output order always follows the caller's content order, while
 * state composition is identical to the single-Article hook.
 */
'use client'

import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import { Q } from '~/query'
import { articlePathKey, articlePathOf, type TArticlePath } from '~/query/articlePath'
import type { TArticle, TArticleState, TArticleStats } from '~/spec'

import { composeArticleState, useArticlePrivateStates, useRefreshStaleArticleStats } from './shared'

type TStatsBatch = {
  community: string
  thread: TArticlePath['thread']
  innerIds: string[]
}

const EMPTY_ARTICLES: readonly TArticle[] = []

const validRef = (path: TArticlePath): boolean =>
  Boolean(path.community && path.thread && path.innerId)

const groupStatsBatches = (paths: readonly TArticlePath[]): TStatsBatch[] => {
  const groups = new Map<string, TStatsBatch>()

  for (const path of paths) {
    const scope = `${path.community}:${path.thread}`
    const group = groups.get(scope) || {
      community: path.community,
      thread: path.thread,
      innerIds: [],
    }
    if (!group.innerIds.includes(String(path.innerId))) group.innerIds.push(String(path.innerId))
    groups.set(scope, group)
  }

  return [...groups.values()].map((group) => ({
    ...group,
    innerIds: group.innerIds.sort(),
  }))
}

/**
 * Returns Article states in input order while batching public stats by community/thread.
 *
 * Missing or invalid paths retain their content with `stats: null`; private viewer state and local
 * confirmations are composed through the same shared precedence rules used by detail pages.
 */
export default function useArticleStates<T extends TArticle>(
  articles: readonly T[] | undefined,
): TArticleState<T>[] {
  const queryClient = useQueryClient()
  const normalizedArticles = articles || (EMPTY_ARTICLES as readonly T[])
  const paths = useMemo(
    () => normalizedArticles.map(articlePathOf).filter(validRef),
    [normalizedArticles],
  )
  const batches = useMemo(() => groupStatsBatches(paths), [paths])

  const statsQueries = useQueries({
    queries: batches.map(({ community, thread, innerIds }) =>
      Q.article.statsBatch(queryClient, community, thread, innerIds),
    ),
  })
  const statsByRef = useMemo(() => {
    const index = new Map<string, TArticleStats>()
    for (const query of statsQueries) {
      for (const stats of query.data || []) index.set(articlePathKey(stats), stats)
    }
    return index
  }, [statsQueries])
  const privateState = useArticlePrivateStates(paths, statsByRef)
  useRefreshStaleArticleStats(queryClient, paths, statsByRef)

  return useMemo(
    () =>
      normalizedArticles.map((article) => {
        const path = articlePathOf(article)
        const key = articlePathKey(path)
        const stats = statsByRef.get(key) || null
        return composeArticleState({
          content: article,
          path,
          stats,
          viewed: privateState.viewerStates?.[key],
          interaction: privateState.interactionStates?.[key],
          viewAcknowledged: privateState.viewAcks.has(key),
          receipt: privateState.receipts.get(key) || null,
        })
      }),
    [normalizedArticles, privateState, statsByRef],
  )
}
