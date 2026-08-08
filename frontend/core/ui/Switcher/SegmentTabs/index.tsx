'use client'

import { type FC, type KeyboardEvent, memo, useMemo } from 'react'

import SIZE from '~/constant/size'
import { cnMerge } from '~/css'

import useSalon from '../salon/segment_tabs'
import type { TProps } from './spec'
import TabItem from './TabItem'

const SegmentTabs: FC<TProps> = ({
  items,
  activeKey,
  onChange = console.log,
  className,
  itemClassName,
  size = SIZE.MEDIUM,
  ...spacing
}) => {
  const s = useSalon({ ...spacing })
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

    if (nextIndex >= 0) {
      handleChange(nextIndex)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown': {
        event.preventDefault()
        moveFocus(1, index)
        break
      }
      case 'ArrowLeft':
      case 'ArrowUp': {
        event.preventDefault()
        moveFocus(-1, index)
        break
      }
      case 'Home': {
        event.preventDefault()
        const firstEnabledIndex = items.findIndex((item) => !item.disabled)
        if (firstEnabledIndex >= 0) handleChange(firstEnabledIndex)
        break
      }
      case 'End': {
        event.preventDefault()
        const lastEnabledIndex = [...items].reverse().findIndex((item) => !item.disabled)
        if (lastEnabledIndex >= 0) handleChange(items.length - 1 - lastEnabledIndex)
        break
      }
      default:
    }
  }

  return (
    <div role='tablist' aria-orientation='horizontal' className={cnMerge(s.wrapper, className)}>
      {items.map((item, index) => (
        <TabItem
          key={item.key}
          item={item}
          index={index}
          active={item.key === renderActiveKey}
          size={size}
          itemClassName={itemClassName}
          onClick={handleChange}
          onKeyDown={handleKeyDown}
        />
      ))}
    </div>
  )
}

export type { TSegmentTabItem } from './spec'
export default memo(SegmentTabs)
