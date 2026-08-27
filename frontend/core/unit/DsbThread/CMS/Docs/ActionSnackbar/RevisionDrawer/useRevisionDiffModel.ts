import type { TRichEditorValue } from '@groupher/rich-editor'
import type { TRichEditorDiffResult } from '@groupher/rich-editor/diff'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import RevisionDiffClient, { type TRevisionDiffScope } from './diffClient'
import {
  EMPTY_DIFF_STATS,
  type TRevisionDiffEntry,
  type TRevisionDiffModel,
  type TRevisionDiffPair,
  type TRevisionDiffSummary,
  type TRevisionHistory,
  type TRevisionSnapshotPair,
} from './model'

export type TRevisionDiffTab = 'published' | 'staged'

type TDiffState = TRevisionDiffPair & TRevisionDiffSummary & { pending: boolean }

type TRet = {
  loadDiffResult: (
    pair: TRevisionDiffPair,
    scope?: TRevisionDiffScope,
  ) => Promise<TRichEditorDiffResult | null>
  revisionDiffModel: TRevisionDiffModel
  startHistoryDiff: (tab: TRevisionDiffTab) => () => void
}

const CURRENT_DIFF_DEBOUNCE_MS = 200

const emptyState = (pair: TRevisionDiffPair, pending = false): TDiffState => ({
  ...pair,
  hasChanges: false,
  pending,
  stats: EMPTY_DIFF_STATS,
})

const summaryFromResult = (result: TRichEditorDiffResult): TRevisionDiffSummary => ({
  hasChanges: result.hasChanges,
  stats: result.stats,
})

const toEntries = (
  pairs: TRevisionSnapshotPair[],
  summaries: Map<string, TRevisionDiffSummary>,
): TRevisionDiffEntry[] =>
  pairs.flatMap((pair) => {
    const summary = summaries.get(pair.key)
    return summary?.hasChanges ? [{ ...pair, ...summary }] : []
  })

const useRevisionDiffModel = (history: TRevisionHistory, bodyValue: TRichEditorValue): TRet => {
  const pairCounterRef = useRef(0)
  const historyGenerationRef = useRef<Record<TRevisionDiffTab, number>>({
    published: 0,
    staged: 0,
  })
  const activeHistoryTabRef = useRef<TRevisionDiffTab | null>(null)
  const [client, setClient] = useState<RevisionDiffClient | null>(null)
  const [historySummaries, setHistorySummaries] = useState(
    () => new Map<string, TRevisionDiffSummary>(),
  )
  const [publishedPending, setPublishedPending] = useState(false)
  const [stagedPending, setStagedPending] = useState(false)
  const [publish, setPublish] = useState<TDiffState>(() =>
    emptyState({
      after: bodyValue,
      before: history.publishedBaselineValue,
      key: 'publish:initial',
    }),
  )
  const [current, setCurrent] = useState<TDiffState>(() =>
    emptyState({
      after: bodyValue,
      before: history.currentBaselineValue,
      key: 'current:initial',
    }),
  )
  const currentRef = useRef(current)

  useEffect(() => {
    currentRef.current = current
  }, [current])

  useEffect(() => {
    if (typeof Worker === 'undefined') return

    const nextClient = new RevisionDiffClient()
    setClient(nextClient)
    return () => nextClient.terminate()
  }, [])

  useEffect(() => {
    const pairNumber = pairCounterRef.current + 1
    pairCounterRef.current = pairNumber
    const publishPair: TRevisionDiffPair = {
      after: bodyValue,
      before: history.publishedBaselineValue,
      key: `publish:${pairNumber}`,
    }
    const hasSharedLivePair = history.currentBaselineValue === history.publishedBaselineValue
    const currentPair: TRevisionDiffPair = {
      after: bodyValue,
      before: history.currentBaselineValue,
      key: hasSharedLivePair ? publishPair.key : `current:${pairNumber}`,
    }

    setPublish(emptyState(publishPair, !!client))
    setCurrent((latest) => ({
      ...currentPair,
      hasChanges: latest.hasChanges,
      pending: !!client && activeHistoryTabRef.current === 'staged',
      stats: latest.stats,
    }))
    if (!client) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      void client
        .getOrCompute(publishPair, 'publish')
        .then((result) => {
          if (cancelled) return
          setPublish((latest) =>
            latest.key === publishPair.key
              ? { ...publishPair, ...summaryFromResult(result), pending: false }
              : latest,
          )
        })
        .catch(() => {
          if (cancelled) return
          setPublish((latest) =>
            latest.key === publishPair.key ? { ...latest, pending: false } : latest,
          )
        })

      if (activeHistoryTabRef.current === 'staged') {
        void client
          .getOrCompute(currentPair, 'current')
          .then((result) => {
            if (cancelled || activeHistoryTabRef.current !== 'staged') return
            setCurrent((latest) =>
              latest.key === currentPair.key
                ? { ...currentPair, ...summaryFromResult(result), pending: false }
                : latest,
            )
          })
          .catch(() => {
            if (cancelled) return
            setCurrent((latest) =>
              latest.key === currentPair.key ? { ...latest, pending: false } : latest,
            )
          })
      }
    }, CURRENT_DIFF_DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [bodyValue, client, history.currentBaselineValue, history.publishedBaselineValue])

  const startHistoryDiff = useCallback(
    (tab: TRevisionDiffTab): (() => void) => {
      if (!client) return () => undefined

      const generation = historyGenerationRef.current[tab] + 1
      historyGenerationRef.current[tab] = generation
      activeHistoryTabRef.current = tab
      const setPending = tab === 'staged' ? setStagedPending : setPublishedPending
      const currentPair = currentRef.current
      const pairs: Array<TRevisionDiffPair | TRevisionSnapshotPair> =
        tab === 'staged' ? [currentPair, ...history.stagedPairs] : history.publishedPairs
      let cancelled = false
      setPending(true)
      if (tab === 'staged') setCurrent((value) => ({ ...value, pending: true }))

      const computeHistory = async (): Promise<void> => {
        for (const pair of pairs) {
          try {
            const scope = pair.key === currentPair.key ? 'current' : 'history'
            const result = await client.getOrCompute(pair, scope)
            if (cancelled || historyGenerationRef.current[tab] !== generation) return
            const summary = summaryFromResult(result)

            if (pair.key === currentPair.key) {
              setCurrent((latest) =>
                latest.key === pair.key ? { ...latest, ...summary, pending: false } : latest,
              )
            } else {
              setHistorySummaries((currentSummaries) => {
                const nextSummaries = new Map(currentSummaries)
                nextSummaries.set(pair.key, summary)
                return nextSummaries
              })
            }
          } catch {
            if (cancelled || historyGenerationRef.current[tab] !== generation) return
          }
        }

        if (!cancelled && historyGenerationRef.current[tab] === generation) setPending(false)
      }

      void computeHistory()

      return () => {
        cancelled = true
        if (historyGenerationRef.current[tab] === generation) {
          historyGenerationRef.current[tab] += 1
          if (activeHistoryTabRef.current === tab) activeHistoryTabRef.current = null
        }
        setPending(false)
        if (tab === 'staged') setCurrent((value) => ({ ...value, pending: false }))
      }
    },
    [client, history.publishedPairs, history.stagedPairs],
  )

  const revisionDiffModel = useMemo<TRevisionDiffModel>(
    () => ({
      current,
      hiddenDraftDuplicateCount: history.hiddenDraftDuplicateCount,
      publish,
      publishedEntries: toEntries(history.publishedPairs, historySummaries),
      publishedPending,
      stagedEntries: toEntries(history.stagedPairs, historySummaries),
      stagedPending,
    }),
    [current, history, historySummaries, publish, publishedPending, stagedPending],
  )

  const loadDiffResult = useCallback(
    (
      pair: TRevisionDiffPair,
      scope: TRevisionDiffScope = 'history',
    ): Promise<TRichEditorDiffResult | null> =>
      client ? client.getOrCompute(pair, scope) : Promise.resolve(null),
    [client],
  )

  return { loadDiffResult, revisionDiffModel, startHistoryDiff }
}

export default useRevisionDiffModel
