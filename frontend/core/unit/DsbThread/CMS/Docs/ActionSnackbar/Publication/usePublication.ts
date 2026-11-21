import type { DocumentNode } from 'graphql'
import { useCallback, useRef, useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import { executeCommand } from '~/query/mutation/optimistic/execute'

import * as S from './schema'
import type {
  ArticleEventDetail,
  ArticleEventPage,
  ArticleDiff,
  Comparison,
  Preview,
  ReleasePage,
  SnapshotPage,
  Policy,
  Versions,
} from './types'

export type Tab = 'preview' | 'diff' | 'history' | 'settings'
export type Detail = { id: number; nodes: Preview['nodes']; page: Preview['page'] }
/** Keeps navigation on one server-checked version and discards late read results. */
export default function usePublication(community: string) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<
    | Preview
    | Comparison
    | ReleasePage
    | SnapshotPage
    | ArticleEventPage
    | ArticleEventDetail
    | ArticleDiff
    | Policy
    | Detail
    | null
  >(null)
  const versions = useRef<Versions | null>(null)
  const sequence = useRef(0)
  const read = useCallback(
    async (
      tab: Tab,
      options: {
        articleId?: string
        releaseId?: number
        snapshotId?: string
        beforeId?: number
        cursor?: Record<string, unknown>
        articleHistory?: boolean
        actorId?: string
        eventId?: string
        beforeSnapshotId?: string
        afterSnapshotId?: string
        baseline?: 'PUBLIC' | 'APPROVAL'
        refresh?: boolean
      } = {},
    ) => {
      const current = ++sequence.current
      if (options.refresh) versions.current = null
      setBusy(true)
      setError(null)
      const appendContributors = Boolean(options.eventId && options.cursor)
      if (!appendContributors) setData(null)
      try {
        const variables = {
          community,
          ...options,
          actorId: options.actorId,
          cursor: options.cursor ? JSON.stringify(options.cursor) : undefined,
          before: options.beforeSnapshotId
            ? { type: 'SNAPSHOT', snapshotId: options.beforeSnapshotId }
            : undefined,
          after: options.afterSnapshotId
            ? { type: 'SNAPSHOT', snapshotId: options.afterSnapshotId }
            : undefined,
          pagi: JSON.stringify({
            limit: 20,
            cursor: options.cursor,
          }),
          versions: versions.current ? JSON.stringify(versions.current) : undefined,
        }
        const query =
          tab === 'settings'
            ? S.policy
            : tab === 'preview'
              ? S.preview
              : tab === 'diff'
                ? S.diff
                : options.beforeSnapshotId && options.afterSnapshotId
                  ? S.articleDiff
                  : options.eventId
                    ? S.articleEvent
                    : options.articleHistory
                      ? S.articleEvents
                      : options.releaseId
                        ? S.release
                        : options.articleId
                          ? S.snapshots
                          : S.releases
        const response = await browserGraphQLRequest<
          Record<
            string,
            | Preview
            | Comparison
            | ReleasePage
            | SnapshotPage
            | ArticleEventPage
            | ArticleEventDetail
            | ArticleDiff
            | Policy
            | Detail
          >
        >(query as DocumentNode, variables)
        if (current !== sequence.current) return
        const result = Object.values(response)[0]
        if ('versions' in result) versions.current = result.versions
        setData((previous) => {
          if (
            appendContributors &&
            previous &&
            'contributors' in previous &&
            'contributors' in result
          ) {
            return {
              ...result,
              contributors: {
                ...result.contributors,
                items: [...previous.contributors.items, ...result.contributors.items],
              },
            }
          }
          return result
        })
      } catch {
        if (current === sequence.current) setError('dsb.doc.publication.changed_or_denied')
      } finally {
        if (current === sequence.current) setBusy(false)
      }
    },
    [community],
  )
  const mutate = useCallback(
    async (action: 'approve' | 'configure' | 'restore', variables: Record<string, unknown>) => {
      const current = ++sequence.current
      setBusy(true)
      setError(null)
      try {
        await executeCommand({
          request: (input) =>
            browserGraphQLRequest(
              action === 'approve' ? S.approve : action === 'restore' ? S.restore : S.configure,
              input,
            ),
          variables: { community, ...variables },
        })
        if (current !== sequence.current) return false
        versions.current = null
        setData(null)
        return true
      } catch {
        if (current === sequence.current) setError('dsb.doc.publication.action_failed')
        return false
      } finally {
        if (current === sequence.current) setBusy(false)
      }
    },
    [community],
  )
  const cancel = useCallback(() => {
    ++sequence.current
    versions.current = null
    setData(null)
    setBusy(false)
    setError(null)
  }, [])
  return { busy, error, data, read, mutate, cancel }
}
