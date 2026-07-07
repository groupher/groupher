import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'

import { SAVE_ACTION_LABEL_KEY } from '../constant'
import useSalon, { cn } from './salon/action_group'

type TProps = {
  variant?: 'article' | 'tree'
  publishLabel: string
  reviewLabel: string
  publishCountLabel: string | null
  showActions: boolean
  publishDisabled: boolean
  optionsDisabled: boolean
  onPublishAll: () => void
  onOpenOptions: () => void
}

const ActionGroup: FC<TProps> = ({
  variant = 'article',
  publishLabel,
  reviewLabel,
  publishCountLabel,
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

  if (variant === 'tree') {
    return (
      <div
        className={cn(s.motion, showActions ? s.treeVisible : s.hidden)}
        aria-hidden={!showActions}
      >
        <div className={s.treeGroup} title={t(SAVE_ACTION_LABEL_KEY.PUBLISH_CHECKLIST)}>
          <button
            type='button'
            className={cn(s.reviewButton, showActions && !optionsDisabled && s.interactive)}
            aria-label={reviewLabel}
            disabled={!showActions || optionsDisabled}
            tabIndex={showActions ? undefined : -1}
            onClick={onOpenOptions}
          >
            {reviewLabel}
            {publishCountLabel && <span className={s.reviewCount}>{publishCountLabel}</span>}
          </button>
          <button
            type='button'
            className={cn(s.treePublishButton, showActions && !publishDisabled && s.interactive)}
            aria-label={t(SAVE_ACTION_LABEL_KEY.PUBLISH_CHECKLIST)}
            disabled={!showActions || publishDisabled}
            tabIndex={showActions ? undefined : -1}
            onClick={onPublishAll}
          >
            {publishLabel}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(s.motion, showActions ? s.visible : s.hidden)} aria-hidden={!showActions}>
      <div
        className={cn(s.group, disabled && s.disabled)}
        title={t(SAVE_ACTION_LABEL_KEY.PUBLISH_CHECKLIST)}
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
          {publishCountLabel && <span className={s.publishCount}>{publishCountLabel}</span>}
        </button>
      </div>
    </div>
  )
}

export default ActionGroup
