/**
 * Owns the private-state and confirmed-write layer shared by Article detail and lists.
 *
 * Business flow:
 *
 *   Article paths + public ArticleStats
 *     -> viewer/interaction queries + session Ack/receipt
 *     -> composeArticleState (pure owner overlay)
 *     -> detail/list TArticleState
 *
 * Network ownership stays in TanStack Query. Session records only protect a confirmed write
 * while public/private projections catch up; this module also removes them after both revisions
 * become authoritative.
 */
'use client'

import { useQuery, type QueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'

import { Q } from '~/query'
import { articlePathKey, type TArticlePath } from '~/query/articlePath'
import { isArticleStatsSnapshotStale } from '~/query/articleStats'
import { invalidate, QueryInvalidation } from '~/query/invalidation'
import {
  clearArticleUpvoteReceipt,
  overlayArticleUpvoteReceiptOnViewerState,
  readArticleUpvoteReceipt,
  type TArticleUpvoteReceipt,
} from '~/query/mutation/articleReceipt'
import { clearArticleViewAck, readArticleViewAck } from '~/query/viewAck'
import type { TArticle, TArticleState, TArticleStats, TArticleViewerState } from '~/spec'
import { getAccountRef } from '~/stores/account/accountRef'
import useAccount from '~/stores/account/hooks'

type TStatsByPath = ReadonlyMap<string, TArticleStats>

/**
 * Marks an expired public snapshot stale once per Article and mounted hook.
 *
 * This schedules the existing stats query for authority refresh without mutating its data or
 * extending `dataUpdatedAt`; repeated renders cannot enqueue duplicate invalidations.
 */
export const useRefreshStaleArticleStats = (
  queryClient: QueryClient,
  paths: readonly TArticlePath[],
  statsByPath: TStatsByPath,
): void => {
  const refreshed = useRef(new Set<string>())

  useEffect(() => {
    for (const path of paths) {
      const key = articlePathKey(path)
      const stats = statsByPath.get(key)
      if (!stats || refreshed.current.has(key) || !isArticleStatsSnapshotStale(stats.snapshotAt)) {
        continue
      }
      refreshed.current.add(key)
      void invalidate(queryClient, QueryInvalidation.article.stats(path))
    }
  }, [paths, queryClient, statsByPath])
}

/**
 * Purely composes one UI-facing Article state from independently owned projections.
 *
 * ViewTracker state, Interaction state, a same-session ViewAck, and a newer confirmed-write
 * receipt are overlaid in that order. The function performs no storage, Query cache, or network
 * access, so detail and list surfaces share exactly the same precedence rules.
 */
export const composeArticleState = <T extends TArticle>({
  content,
  path,
  stats,
  viewed,
  interaction,
  viewAcknowledged,
  receipt,
}: {
  content: T
  path: TArticlePath
  stats: TArticleStats | null
  viewed?: TArticleViewerState
  interaction?: TArticleViewerState
  viewAcknowledged: boolean
  receipt: TArticleUpvoteReceipt | null
}): TArticleState<T> => {
  const viewerState: TArticleViewerState = {
    articleKey: articlePathKey(path),
    ...viewed,
    ...interaction,
    ...(viewAcknowledged ? { viewerHasViewed: true } : {}),
  }

  return {
    content,
    stats,
    viewerState: overlayArticleUpvoteReceiptOnViewerState(stats, viewerState, receipt),
  }
}

/**
 * Subscribes to the two viewer-scoped Article queries and reconciles local confirmations.
 *
 * Query updates deliberately trigger a fresh bounded read of session Ack/receipt maps, including
 * records written after mount. The effect clears a ViewAck after ViewTracker confirms it and clears
 * an interaction receipt only after both public and private revisions reach its private revision.
 */
export const useArticlePrivateStates = (
  paths: readonly TArticlePath[],
  statsByPath: TStatsByPath,
) => {
  const account = useAccount()
  const accountRef = account.accountRef || getAccountRef(account.user) || ''
  const viewerQuery = useQuery(Q.viewer.articleStates(accountRef, paths))
  const interactionQuery = useQuery(Q.viewer.articleInteractionStates(accountRef, paths))

  const localState = useMemo(() => {
    const viewAcks = new Set<string>()
    const receipts = new Map<string, TArticleUpvoteReceipt>()
    for (const path of paths) {
      const key = articlePathKey(path)
      if (readArticleViewAck(key)) viewAcks.add(key)
      const receipt = readArticleUpvoteReceipt(accountRef, key)
      if (receipt) receipts.set(key, receipt)
    }
    return { viewAcks, receipts }
  }, [accountRef, interactionQuery.data, paths, statsByPath, viewerQuery.data])

  useEffect(() => {
    for (const path of paths) {
      const key = articlePathKey(path)
      if (viewerQuery.data?.[key]?.viewerHasViewed === true) clearArticleViewAck(key)

      const receipt = localState.receipts.get(key)
      const receiptRevision = receipt?.interactionRevision
      if (typeof receiptRevision !== 'number') continue
      const statsRevision = statsByPath.get(key)?.interactionRevision
      const privateRevision = interactionQuery.data?.[key]?.interactionRevision
      if (
        typeof statsRevision === 'number' &&
        statsRevision >= receiptRevision &&
        typeof privateRevision === 'number' &&
        privateRevision >= receiptRevision
      ) {
        clearArticleUpvoteReceipt(accountRef, key)
      }
    }
  }, [accountRef, interactionQuery.data, localState.receipts, paths, statsByPath, viewerQuery.data])

  return {
    accountRef,
    interactionStates: interactionQuery.data,
    viewerStates: viewerQuery.data,
    viewAcks: localState.viewAcks,
    receipts: localState.receipts,
  }
}
