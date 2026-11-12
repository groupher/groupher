import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DsbThread/schema/docs'

import useDocsEditor from '../../store/hooks'
import { composeWorkingCopySession } from '../helper'
import type { TDocEditorSource } from '../spec'
import type { TDraftEditorState } from './useDraftEditorState'

/** Explicitly opens a new editing session; neither reads nor stale saves recreate D. */
export default function useBeginDocEdit(state: TDraftEditorState) {
  const { slug: community } = useCommunity()
  const { reloadSideTree } = useDocsEditor()
  const [starting, setStarting] = useState(false)
  const latest = useRef(state)
  useLayoutEffect(() => {
    latest.current = state
  }, [state])
  const inFlight = useRef(false)

  const beginEdit = useCallback(async () => {
    const current = latest.current
    const articleId = current.activePage?.docId
    if (
      !articleId ||
      !current.publicSnapshotId ||
      current.workingCopyId ||
      current.dirty ||
      inFlight.current
    )
      return
    inFlight.current = true
    setStarting(true)
    try {
      const result = await executeCommand({
        request: (variables) => browserGraphQLRequest(S.beginDocsEdit, variables),
        variables: { community, articleId, publicSnapshotId: current.publicSnapshotId },
      })
      const data = await browserGraphQLRequest<{ docsEditor: TDocEditorSource }>(S.docsEditor, {
        community,
        articleId,
      })
      if (
        latest.current.activePage?.docId !== articleId ||
        latest.current.dirty ||
        latest.current.workingCopyId ||
        latest.current.publicSnapshotId !== current.publicSnapshotId
      )
        return
      const copy = data.docsEditor.workingCopy
      if (!copy || copy.id !== result?.beginDocsEdit?.workingCopyId)
        throw new Error('The editing session changed. Reload before editing.')
      current.applyLoaded(composeWorkingCopySession(copy, current.activePage))
      reloadSideTree?.()
    } catch (error) {
      if (latest.current.activePage?.docId === articleId)
        current.setLoadError(error instanceof Error ? error.message : String(error))
    } finally {
      inFlight.current = false
      setStarting(false)
    }
  }, [community, reloadSideTree])

  return { beginEdit, starting }
}
