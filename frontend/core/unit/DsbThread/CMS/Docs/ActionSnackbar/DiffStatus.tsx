'use client'

import { type FC, lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'

import { DSB_DOC_EVENT } from '~/const/dsb/docs'
import { browserGraphQLRequest } from '~/graphql/client'
import useEvent from '~/hooks/useEvent'
import useTrans from '~/hooks/useTrans'
import MergeSVG from '~/icons/Merge'
import S from '~/unit/DsbThread/schema/docs'

import useDocsEditor from '../Editor/store/hooks'
import { DOC_ACTION_LABEL_KEY } from './constant'
import { buildRevisionHistory } from './RevisionDrawer/model'
import type { TDocBranchRevision, TDocBranchVersionsPayload } from './RevisionDrawer/spec'
import useRevisionDiffModel from './RevisionDrawer/useRevisionDiffModel'
import useSalon, { cn } from './salon/diff_status'

const RevisionDrawer = lazy(() => import('./RevisionDrawer'))

const DiffStatus: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const { bodyValue, docDraftInfo } = useDocsEditor()
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [publishedRevisions, setPublishedRevisions] = useState<TDocBranchRevision[]>([])
  const docDraftId = docDraftInfo.id
  const branchId = docDraftInfo.branchId
  const label = t(DOC_ACTION_LABEL_KEY.DIFF)

  const loadRevisions = useCallback(async (): Promise<void> => {
    if (!docDraftId || !branchId) {
      setPublishedRevisions([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await browserGraphQLRequest<TDocBranchVersionsPayload>(S.docBranchVersions, {
        docId: docDraftId,
        branchId,
      })

      setPublishedRevisions(
        (data?.docBranchVersions || []).map((version) => ({
          id: version.revisionId,
          branchVersionId: version.id,
          documentJson: version.content.documentJson,
          insertedAt: version.publishedAt,
          revisionNumber: version.versionNumber,
          title: version.content.title,
          subtitle: version.content.subtitle,
        })),
      )
    } catch (err) {
      setPublishedRevisions([])
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [branchId, docDraftId])

  useEffect(() => {
    void loadRevisions()
  }, [loadRevisions])

  useEvent(
    DSB_DOC_EVENT.REVISION_RELOAD,
    (): void => {
      void loadRevisions()
    },
    [loadRevisions],
  )

  const revisionHistory = useMemo(
    () =>
      buildRevisionHistory({
        draftRevisions: [],
        publishedRevisions,
      }),
    [publishedRevisions],
  )
  const { loadDiffResult, revisionDiffModel, startHistoryDiff } = useRevisionDiffModel(
    revisionHistory,
    bodyValue,
  )
  const stats = revisionDiffModel.publish.stats
  const hasChanges = revisionDiffModel.publish.hasChanges

  return (
    <>
      <button
        type='button'
        className={cn(s.button, visible && s.buttonActive)}
        aria-label={label}
        title={label}
        onClick={() => setVisible(true)}
      >
        <MergeSVG className={cn(s.icon, visible && s.iconActive)} />
        {hasChanges && (
          <>
            <span className={s.additions}>+{stats.additions}</span>
            <span className={s.deletions}>-{stats.deletions}</span>
          </>
        )}
      </button>

      {visible && (
        <Suspense fallback={null}>
          <RevisionDrawer
            show={visible}
            loading={loading}
            error={error}
            revisionDiffModel={revisionDiffModel}
            loadDiffResult={loadDiffResult}
            startHistoryDiff={startHistoryDiff}
            onClose={() => setVisible(false)}
            onReload={loadRevisions}
          />
        </Suspense>
      )}
    </>
  )
}

export default DiffStatus
