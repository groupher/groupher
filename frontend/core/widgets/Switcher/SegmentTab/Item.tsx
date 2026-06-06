'use client'

import type { FC } from 'react'

import useSalon from '../salon/segment_tab/item'
import type { TSegmentTabOptionProps } from './spec'

const SegmentTabItem: FC<TSegmentTabOptionProps> = ({
  item,
  index,
  active,
  onClick,
  onKeyDown,
}) => {
  const s = useSalon({ active, disabled: item.disabled })
  const Icon = item.icon

  return (
    <button
      type='button'
      role='radio'
      aria-checked={active}
      disabled={item.disabled}
      data-segment-tab-active={active ? 'true' : undefined}
      className={s.item}
      onClick={() => onClick(index)}
      onKeyDown={(event) => onKeyDown(event, index)}
    >
      {Icon && <Icon className={s.icon} />}
      <span className={s.label}>{item.label}</span>
    </button>
  )
}

export default SegmentTabItem
