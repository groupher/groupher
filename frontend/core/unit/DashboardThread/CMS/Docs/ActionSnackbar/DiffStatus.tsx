import { type FC, useEffect, useMemo, useState } from 'react'

import useGraphQLClient from '~/hooks/useGraphQLClient'
import MergeSVG from '~/icons/Merge'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DashboardThread/schema'

import useDocsEditor from '../Editor/store/hooks'
import { DOC_ACTION } from './constant'
import RevisionDrawer from './RevisionDrawer'
import { computeRevisionDiffStats, parseRevisionDocumentValue } from './RevisionDrawer/helper'
import type { TArticleRevision, TDocDraftRevisionPayload } from './RevisionDrawer/spec'
import useSalon, { cn } from './salon/diff_status'

const DiffStatus: FC = () => {
  const s = useSalon()
  const { slug: community } = useCommunity()
  const { query } = useGraphQLClient()
  const { baselineValue, bodyValue, docDraftInfo } = useDocsEditor()
  const [visible, setVisible] = useState(false)
  const [latestPublished, setLatestPublished] = useState<TArticleRevision | null>(null)
  const docDraftId = docDraftInfo.id

  useEffect(() => {
    if (!docDraftId) {
      setLatestPublished(null)
      return
    }

    query<TDocDraftRevisionPayload>(S.docDraftRevisions, {
      community,
      id: docDraftId,
      type: 'PUBLISHED',
    })
      .then((data) => {
        setLatestPublished(data?.docDraftRevisions?.[0] || null)
      })
      .catch(() => {
        setLatestPublished(null)
      })
  }, [community, docDraftId, query])

  const stats = useMemo(() => {
    const previousValue = latestPublished
      ? parseRevisionDocumentValue(latestPublished.documentJson)
      : baselineValue
    return computeRevisionDiffStats(previousValue, bodyValue)
  }, [baselineValue, bodyValue, latestPublished])

  return (
    <>
      <button
        type='button'
        className={cn(s.button, visible && s.buttonActive)}
        aria-label={DOC_ACTION.DIFF}
        title={DOC_ACTION.DIFF}
        onClick={() => setVisible(true)}
      >
        <MergeSVG className={cn(s.icon, visible && s.iconActive)} />
        <span className={s.additions}>+{stats.additions}</span>
        <span className={s.deletions}>-{stats.deletions}</span>
      </button>

      <RevisionDrawer show={visible} onClose={() => setVisible(false)} />
    </>
  )
}

export default DiffStatus
