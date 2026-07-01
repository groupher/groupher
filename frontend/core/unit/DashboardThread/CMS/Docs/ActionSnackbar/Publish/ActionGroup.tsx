import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import SettingSVG from '~/icons/Setting'

import { SAVE_ACTION_LABEL_KEY } from '../constant'
import useSalon, { cn } from './salon/action_group'

type TProps = {
  publishLabel: string
  showActions: boolean
  publishDisabled: boolean
  optionsDisabled: boolean
  onPublishAll: () => void
  onOpenOptions: () => void
}

const ActionGroup: FC<TProps> = ({
  publishLabel,
  showActions,
  publishDisabled,
  optionsDisabled,
  onPublishAll,
  onOpenOptions,
}) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={cn(s.motion, showActions ? s.visible : s.hidden)} aria-hidden={!showActions}>
      <div className={s.group} title={t(SAVE_ACTION_LABEL_KEY.PUBLISH_SCOPE)}>
        <button
          type='button'
          className={s.publishButton}
          aria-label={t(SAVE_ACTION_LABEL_KEY.PUBLISH_CURRENT)}
          disabled={!showActions || publishDisabled}
          tabIndex={showActions ? undefined : -1}
          onClick={onPublishAll}
        >
          {publishLabel}
        </button>
        <button
          type='button'
          className={s.optionsButton}
          aria-label={t(SAVE_ACTION_LABEL_KEY.PUBLISH_OPTIONS)}
          title={t(SAVE_ACTION_LABEL_KEY.PUBLISH_OPTIONS)}
          disabled={!showActions || optionsDisabled}
          tabIndex={showActions ? undefined : -1}
          onClick={onOpenOptions}
        >
          <SettingSVG className={s.icon} />
        </button>
      </div>
    </div>
  )
}

export default ActionGroup
