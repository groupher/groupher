/**
 * Builds the normalized Article state consumed by a single detail or drawer surface.
 *
 *   Article content
 *     -> real single-Article stats query
 *     -> shared private-state/reconciliation layer
 *     -> { content, stats, viewerState }
 *
 * The hook owns only the detail stats query; private-state precedence and confirmed-write cleanup
 * remain shared with list surfaces.
 */
'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import { THREAD } from '~/const/thread'
import { Q } from '~/query'
import { articlePathKey, articlePathOf } from '~/query/articlePath'
import type { TArticle, TArticleState, TArticleStats } from '~/spec'

import {
  composeArticleState,
  useArticlePrivateStates,
  useRefreshStaleArticleStats,
} from '../useArticleStates/shared'

/**
 * Returns the composed state for one Article, or `null` before content exists.
 *
 * It reads the real detail stats key, refreshes stale snapshots, and delegates all private owner
 * queries and session confirmation handling to the shared Article-state layer.
 */
export default function useArticleState<T extends TArticle>(
  article: T | null | undefined,
): TArticleState<T> | null {
  const queryClient = useQueryClient()
  const path = useMemo(() => (article ? articlePathOf(article) : null), [article])
  const paths = useMemo(() => (path ? [path] : []), [path])
  const statsQuery = useQuery({
    ...Q.article.stats(
      queryClient,
      path?.community || '',
      path?.thread || THREAD.POST,
      path?.innerId || '',
    ),
    enabled: Boolean(path),
  })
  const statsByPath = useMemo(() => {
    const values = new Map<string, TArticleStats>()
    if (path && statsQuery.data) values.set(articlePathKey(path), statsQuery.data)
    return values
  }, [path, statsQuery.data])
  const privateState = useArticlePrivateStates(paths, statsByPath)
  useRefreshStaleArticleStats(queryClient, paths, statsByPath)

  return useMemo(() => {
    if (!article || !path) return null
    const key = articlePathKey(path)
    return composeArticleState({
      content: article,
      path,
      stats: statsQuery.data || null,
      viewed: privateState.viewerStates?.[key],
      interaction: privateState.interactionStates?.[key],
      viewAcknowledged: privateState.viewAcks.has(key),
      receipt: privateState.receipts.get(key) || null,
    })
  }, [article, path, privateState, statsQuery.data])
}
