import { type FC, useEffect, useMemo, useState } from 'react'

import useGraphQLClient from '~/hooks/useGraphQLClient'
import useTrans from '~/hooks/useTrans'
import MergeSVG from '~/icons/Merge'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DashboardThread/schema'

import useDocsEditor from '../Editor/store/hooks'
import { DOC_ACTION_LABEL_KEY, DOC_REVISION_RELOAD_EVENT } from './constant'
import RevisionDrawer from './RevisionDrawer'
import { buildRevisionDiffModel, hasRevisionDiffStats } from './RevisionDrawer/helper'
import type { TArticleSnapshot, TDocDraftSnapshotsPayload } from './RevisionDrawer/spec'
import useSalon, { cn } from './salon/diff_status'

const DiffStatus: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const { slug: community } = useCommunity()
  const { query } = useGraphQLClient()
  const { baselineValue, bodyValue, docDraftInfo } = useDocsEditor()
  const [visible, setVisible] = useState(false)
  const [draftRevisions, setDraftRevisions] = useState<TArticleSnapshot[]>([])
  const [publishedRevisions, setPublishedRevisions] = useState<TArticleSnapshot[]>([])
  const docDraftId = docDraftInfo.id
  const label = t(DOC_ACTION_LABEL_KEY.DIFF)

  useEffect(() => {
    if (!docDraftId) {
      setDraftRevisions([])
      setPublishedRevisions([])
      return
    }

    const loadRevisions = (): void => {
      Promise.all([
        query<TDocDraftSnapshotsPayload>(S.docDraftSnapshots, {
          community,
          id: docDraftId,
          stage: 'DRAFT',
        }),
        query<TDocDraftSnapshotsPayload>(S.docDraftSnapshots, {
          community,
          id: docDraftId,
          stage: 'PUBLIC',
        }),
      ])
        .then(([draftData, publishedData]) => {
          setDraftRevisions(draftData?.docDraftSnapshots || [])
          setPublishedRevisions(publishedData?.docDraftSnapshots || [])
        })
        .catch(() => {
          setDraftRevisions([])
          setPublishedRevisions([])
        })
    }

    loadRevisions()

    window.addEventListener(DOC_REVISION_RELOAD_EVENT, loadRevisions)
    return () => {
      window.removeEventListener(DOC_REVISION_RELOAD_EVENT, loadRevisions)
    }
  }, [community, docDraftId, query])

  const stats = useMemo(() => {
    return buildRevisionDiffModel({
      baselineValue,
      bodyValue,
      draftRevisions,
      publishedRevisions,
    }).stagedStats
  }, [baselineValue, bodyValue, draftRevisions, publishedRevisions])
  const hasStats = hasRevisionDiffStats(stats)

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
        {hasStats && (
          <>
            <span className={s.additions}>+{stats.additions}</span>
            <span className={s.deletions}>-{stats.deletions}</span>
          </>
        )}
      </button>

      <RevisionDrawer show={visible} onClose={() => setVisible(false)} />
    </>
  )
}

export default DiffStatus
