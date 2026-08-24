'use client'

import { type FC, lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'

import { DSB_DOC_EVENT } from '~/const/dsb/docs'
import { browserQuery } from '~/graphql/client'
import useEvent from '~/hooks/useEvent'
import useTrans from '~/hooks/useTrans'
import MergeSVG from '~/icons/Merge'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DashboardThread/schema/docs'

import useDocsEditor from '../Editor/store/hooks'
import { DOC_ACTION_LABEL_KEY } from './constant'
import { buildRevisionHistory } from './RevisionDrawer/model'
import type { TDocSnapshot, TDocDraftSnapshotsPayload } from './RevisionDrawer/spec'
import useRevisionDiffModel from './RevisionDrawer/useRevisionDiffModel'
import useSalon, { cn } from './salon/diff_status'

const RevisionDrawer = lazy(() => import('./RevisionDrawer'))

const DiffStatus: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const { slug: community } = useCommunity()
  const { bodyValue, docDraftInfo } = useDocsEditor()
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftRevisions, setDraftRevisions] = useState<TDocSnapshot[]>([])
  const [publishedRevisions, setPublishedRevisions] = useState<TDocSnapshot[]>([])
  const docDraftId = docDraftInfo.id
  const label = t(DOC_ACTION_LABEL_KEY.DIFF)

  const loadRevisions = useCallback(async (): Promise<void> => {
    if (!docDraftId) {
      setDraftRevisions([])
      setPublishedRevisions([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [draftData, publishedData] = await Promise.all([
        browserQuery<TDocDraftSnapshotsPayload>(S.docDraftSnapshots, {
          community,
          id: docDraftId,
          stage: 'DRAFT',
        }),
        browserQuery<TDocDraftSnapshotsPayload>(S.docDraftSnapshots, {
          community,
          id: docDraftId,
          stage: 'PUBLIC',
        }),
      ])

      setDraftRevisions(draftData?.docDraftSnapshots || [])
      setPublishedRevisions(publishedData?.docDraftSnapshots || [])
    } catch (err) {
      setDraftRevisions([])
      setPublishedRevisions([])
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [community, docDraftId])

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
        draftRevisions,
        publishedRevisions,
      }),
    [draftRevisions, publishedRevisions],
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
