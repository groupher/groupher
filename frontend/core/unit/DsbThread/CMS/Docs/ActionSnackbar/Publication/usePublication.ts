import { useCallback, useRef, useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import { executeCommand } from '~/query/mutation/optimistic/execute'

import * as S from './schema'
import type { Comparison, Preview, ReleasePage, SnapshotPage, Policy, Versions } from './types'

export type Tab = 'preview' | 'diff' | 'history' | 'settings'
export type Detail = { id: number; nodes: Preview['nodes']; page: Preview['page'] }
/** Keeps navigation on one server-checked version and discards late read results. */
export default function usePublication(community: string) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<
    Preview | Comparison | ReleasePage | SnapshotPage | Policy | Detail | null
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
        baseline?: 'PUBLIC' | 'APPROVAL'
        refresh?: boolean
      } = {},
    ) => {
      const current = ++sequence.current
      if (options.refresh) versions.current = null
      setBusy(true)
      setError(null)
      setData(null)
      try {
        const variables = {
          community,
          ...options,
          cursor: options.cursor ? JSON.stringify(options.cursor) : undefined,
          versions: versions.current ? JSON.stringify(versions.current) : undefined,
        }
        const query =
          tab === 'settings'
            ? S.policy
            : tab === 'preview'
              ? S.preview
              : tab === 'diff'
                ? S.diff
                : options.releaseId
                  ? S.release
                  : options.articleId
                    ? S.snapshots
                    : S.releases
        const response = await browserGraphQLRequest<
          Record<string, Preview | Comparison | ReleasePage | SnapshotPage | Policy | Detail>
        >(query, variables)
        if (current !== sequence.current) return
        const result = Object.values(response)[0]
        if ('versions' in result) versions.current = result.versions
        setData(result)
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
