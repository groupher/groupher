import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import FilterSVG from '~/icons/Filter'

import { SAVE_ACTION_LABEL_KEY } from '../constant'
import useSalon, { cn } from './salon/action_group'

type TProps = {
  publishLabel: string
  publishCount: number
  showActions: boolean
  publishDisabled: boolean
  optionsDisabled: boolean
  onPublishAll: () => void
  onOpenOptions: () => void
}

const ActionGroup: FC<TProps> = ({
  publishLabel,
  publishCount,
  showActions,
  publishDisabled,
  optionsDisabled,
  onPublishAll,
  onOpenOptions,
}) => {
  const s = useSalon()
  const { t } = useTrans()
  const disabled = !showActions || publishDisabled || optionsDisabled
  const canHover = !disabled

  return (
    <div className={cn(s.motion, showActions ? s.visible : s.hidden)} aria-hidden={!showActions}>
      <div
        className={cn(s.group, disabled && s.disabled)}
        title={t(SAVE_ACTION_LABEL_KEY.PUBLISH_SCOPE)}
      >
        <button
          type='button'
          className={cn(s.publishButton, canHover && s.interactive)}
          aria-label={t(SAVE_ACTION_LABEL_KEY.PUBLISH_CURRENT)}
          disabled={!showActions || publishDisabled}
          tabIndex={showActions ? undefined : -1}
          onClick={onPublishAll}
        >
          {publishLabel}
          {publishCount > 0 && <span className={s.publishCount}>{publishCount}</span>}
        </button>
        <button
          type='button'
          className={cn(s.optionsButton, canHover && s.interactive, 'relative')}
          aria-label={t(SAVE_ACTION_LABEL_KEY.PUBLISH_OPTIONS)}
          title={t(SAVE_ACTION_LABEL_KEY.PUBLISH_OPTIONS)}
          disabled={!showActions || optionsDisabled}
          tabIndex={showActions ? undefined : -1}
          onClick={onOpenOptions}
        >
          <div className={s.divider} />
          <FilterSVG className={s.icon} />
        </button>
      </div>
    </div>
  )
}

export default ActionGroup
