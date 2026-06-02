'use client'

import { type FC, type KeyboardEvent, memo, useMemo } from 'react'

import useSalon, { cn } from '../salon/segment_tab'
import SegmentTabItem from './Item'
import type { TSegmentTabProps } from './spec'

const SegmentTab: FC<TSegmentTabProps> = ({
  items,
  activeKey,
  ariaLabel,
  className,
  onChange = console.log,
}) => {
  const s = useSalon()
  const enabledItems = useMemo(() => items.filter((item) => !item.disabled), [items])
  const renderActiveKey = enabledItems.some((item) => item.key === activeKey)
    ? activeKey
    : enabledItems[0]?.key

  const handleChange = (index: number) => {
    const item = items[index]
    if (!item || item.disabled || item.key === activeKey) return

    onChange(item.key, item, index)
  }

  const moveFocus = (direction: 1 | -1, currentIndex: number) => {
    if (enabledItems.length <= 1) return

    const currentKey = items[currentIndex]?.key
    const currentEnabledIndex = enabledItems.findIndex((item) => item.key === currentKey)
    const fallbackIndex = enabledItems.findIndex((item) => item.key === renderActiveKey)
    const startIndex = currentEnabledIndex >= 0 ? currentEnabledIndex : Math.max(fallbackIndex, 0)
    const nextEnabledIndex = (startIndex + direction + enabledItems.length) % enabledItems.length
    const nextItem = enabledItems[nextEnabledIndex]
    const nextIndex = items.findIndex((item) => item.key === nextItem.key)

    if (nextIndex >= 0) handleChange(nextIndex)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        moveFocus(1, index)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        moveFocus(-1, index)
        break
      default:
    }
  }

  return (
    <div role='radiogroup' aria-label={ariaLabel} className={cn(s.wrapper, className)}>
      {items.map((item, index) => (
        <SegmentTabItem
          key={item.key}
          item={item}
          index={index}
          active={item.key === renderActiveKey}
          onClick={handleChange}
          onKeyDown={handleKeyDown}
        />
      ))}
    </div>
  )
}

export type { TSegmentTabOption } from './spec'

export default memo(SegmentTab)
