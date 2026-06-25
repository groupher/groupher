import { type FC, useEffect, useMemo, useState } from 'react'

import useGraphQLClient from '~/hooks/useGraphQLClient'
import useTrans from '~/hooks/useTrans'
import MergeSVG from '~/icons/Merge'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DashboardThread/schema'

import useDocsEditor from '../Editor/store/hooks'
import { DOC_ACTION_LABEL_KEY } from './constant'
import RevisionDrawer from './RevisionDrawer'
import { computeRevisionDiffStats, parseRevisionDocumentValue } from './RevisionDrawer/helper'
import type { TArticleRevision, TDocDraftRevisionPayload } from './RevisionDrawer/spec'
import useSalon, { cn } from './salon/diff_status'

const DiffStatus: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const { slug: community } = useCommunity()
  const { query } = useGraphQLClient()
  const { baselineValue, bodyValue, docDraftInfo } = useDocsEditor()
  const [visible, setVisible] = useState(false)
  const [latestPublished, setLatestPublished] = useState<TArticleRevision | null>(null)
  const docDraftId = docDraftInfo.id
  const label = t(DOC_ACTION_LABEL_KEY.DIFF)

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
        aria-label={label}
        title={label}
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
