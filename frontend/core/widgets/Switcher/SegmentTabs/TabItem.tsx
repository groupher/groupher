'use client'

import type { FC } from 'react'

import useSalon, { cn } from '../salon/segment_tabs/tab_item'
import type { TSegmentTabItemProps } from './spec'

const TabItem: FC<TSegmentTabItemProps> = ({
  item,
  index,
  active,
  size,
  itemClassName,
  onClick,
  onKeyDown,
}) => {
  const s = useSalon({ size, active, disabled: item.disabled })

  return (
    <button
      type='button'
      role='tab'
      aria-selected={active}
      disabled={item.disabled}
      tabIndex={active ? 0 : -1}
      className={cn(s.item, itemClassName)}
      onClick={() => onClick?.(index)}
      onKeyDown={(event) => onKeyDown?.(event, index)}
    >
      {item.label}
    </button>
  )
}

export default TabItem
