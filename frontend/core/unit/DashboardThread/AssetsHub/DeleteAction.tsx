'use client'

import IconHub from '~/widgets/IconHub'

import { ASSETS_HUB_LABEL } from './constant'
import useSalon from './salon/delete_action'

type TProps = {
  confirming: boolean
  deleting: boolean
  disabled: boolean
  referenced: boolean
  onDelete: () => void
}

export default function DeleteAction({
  confirming,
  deleting,
  disabled,
  referenced,
  onDelete,
}: TProps) {
  const s = useSalon({ confirming, referenced })
  const label = referenced
    ? ASSETS_HUB_LABEL.DELETE_BLOCKED
    : confirming
      ? ASSETS_HUB_LABEL.DELETE_CONFIRMING
      : ASSETS_HUB_LABEL.DELETE

  return (
    <button
      type='button'
      className={s.button}
      onClick={onDelete}
      aria-label={label}
      disabled={disabled || referenced || deleting}
    >
      <IconHub
        provider='lucide'
        icon={referenced ? 'ban' : confirming ? 'alert-triangle' : 'trash'}
        size={3.25}
      />
    </button>
  )
}
