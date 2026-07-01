import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import FileCheckSVG from '~/icons/FileCheck'
import RefreshCwSVG from '~/icons/RefreshCw'
import Tooltip from '~/widgets/Tooltip'

import useDocsEditor from '../../Editor/store/hooks'
import { SAVE_ACTION_LABEL_KEY, SAVE_STATUS_LABEL } from '../constant'
import useSalon from './salon'
import TooltipPanel from './TooltipPanel'

const SyncDraft: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const { docDraftInfo, publishView, saveDocDraft, saveStatus } = useDocsEditor()
  const error = saveStatus === 'error'
  const labelKey = SAVE_STATUS_LABEL[saveStatus] ?? SAVE_ACTION_LABEL_KEY.SAVED
  const label = t(labelKey)

  return publishView.isSaving || publishView.isDirty || error ? (
    <button type='button' className={s.button} aria-label={label} onClick={saveDocDraft}>
      {publishView.isSaving && <RefreshCwSVG className={s.syncIcon} />}
      {publishView.isDirty && <span className={s.dirtyDot} />}
      {error && <span className={s.errorDot} />}
    </button>
  ) : (
    <Tooltip
      content={<TooltipPanel updatedAt={docDraftInfo.updatedAt} />}
      placement='top'
      offset={[0, 10]}
      maxWidth={240}
    >
      <button type='button' className={s.button} aria-label={label} onClick={saveDocDraft}>
        <FileCheckSVG className={s.savedIcon} />
      </button>
    </Tooltip>
  )
}

export default SyncDraft
