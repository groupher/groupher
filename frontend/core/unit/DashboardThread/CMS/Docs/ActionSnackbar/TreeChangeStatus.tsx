import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import TrashSVG from '~/icons/Trash'

import useDocsEditor from '../Editor/store/hooks'
import { SAVE_ACTION_LABEL_KEY } from './constant'
import { formatTreeChangeSummary } from './Publish/helper'
import type { TPublishChecklist } from './Publish/spec'
import useSalon from './salon/tree_change_status'

type TProps = {
  publishChecklist: TPublishChecklist | null
}

const TreeChangeStatus: FC<TProps> = ({ publishChecklist }) => {
  const s = useSalon()
  const { t } = useTrans()
  const { publishView } = useDocsEditor()
  const label = formatTreeChangeSummary({
    checklist: publishChecklist,
    fallbackCount: publishView.publishCount,
    checkingLabel: t(SAVE_ACTION_LABEL_KEY.TREE_CHANGE_CHECKING),
    noChangesLabel: t(SAVE_ACTION_LABEL_KEY.PUBLISH_NO_CHANGES),
    detectedLabel: t(SAVE_ACTION_LABEL_KEY.TREE_CHANGE_DETECTED),
    changePendingLabel: t(SAVE_ACTION_LABEL_KEY.TREE_CHANGE_PENDING),
    changesPendingLabel: t(SAVE_ACTION_LABEL_KEY.TREE_CHANGES_PENDING),
  })

  return (
    <div className={s.wrapper} title={label}>
      <TrashSVG className={s.icon} />
      <span className={s.label}>{label}</span>
    </div>
  )
}

export default TreeChangeStatus
