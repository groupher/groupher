'use client'

import { findIndex, isEmpty } from 'ramda'
import type { FC } from 'react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import SIZE from '~/const/size'
import { isString } from '~/validator'

import useSalon from '../salon/tabs'
import type { TTabItem, TViewProps } from './spec'
import TabItem from './TabItem'

const temItems: TTabItem[] = [
  {
    title: '帖子',
    slug: 'posts',
    icon: 'settings',
  },
]

const getItemKey = (item: TTabItem): string =>
  isString(item) ? item : item.slug || item.title || ''

const getDefaultActiveTabIndex = (items: readonly TTabItem[], activeKey: string): number => {
  if (isEmpty(activeKey)) return 0

  const index = findIndex((item) => activeKey === getItemKey(item), items as TTabItem[])
  return index >= 0 ? index : 0
}

const getTabLabelWidth = (node?: Element): number => {
  if (!(node instanceof HTMLElement)) return 0

  const labelEl = node.querySelector<HTMLElement>('[data-tab-label="true"]')
  return labelEl?.offsetWidth ?? node.offsetWidth
}

type TTabMetrics = {
  widths: number[]
  offsets: number[]
  activeLabelWidth: number
}

const INITIAL_METRICS: TTabMetrics = {
  widths: [],
  offsets: [],
  activeLabelWidth: 0,
}

const sameNumbers = (left: number[], right: number[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index])

const Tabs: FC<TViewProps> = ({
  size = SIZE.MEDIUM,
  onChange = () => {},
  items = temItems,
  activeKey = '',
  slipHeight = 0.5,
  slipBarPos = 'bottom',
  topSpace = 0.5,
  bottomSpace = 0.5,
  noAnimation = false,
  variant = 'default',
  ...spacing
}) => {
  const s = useSalon({ noAnimation, slipHeight, slipBarPos, variant, ...spacing })

  const defaultActiveTabIndex = getDefaultActiveTabIndex(items, activeKey)
  const hasActiveItem = items.some((it) => getItemKey(it) === activeKey)

  const [metrics, setMetrics] = useState<TTabMetrics>(INITIAL_METRICS)
  const [hasMeasured, setHasMeasured] = useState(false)

  const navRef = useRef<HTMLElement | null>(null)

  const measureTabs = useCallback((activeIndex: number) => {
    const navEl = navRef.current
    if (!navEl) return

    const tabNodes = Array.from(navEl.querySelectorAll<HTMLElement>(':scope > [data-tab-item]'))
    const widths = tabNodes.map((node) => node.offsetWidth)
    const offsets = tabNodes.map((node) => node.offsetLeft)
    const activeLabelWidth = getTabLabelWidth(tabNodes[activeIndex])

    setMetrics((prev) =>
      sameNumbers(prev.widths, widths) &&
      sameNumbers(prev.offsets, offsets) &&
      prev.activeLabelWidth === activeLabelWidth
        ? prev
        : { widths, offsets, activeLabelWidth },
    )
  }, [])

  useLayoutEffect(() => {
    const navEl = navRef.current
    if (!navEl) return

    measureTabs(defaultActiveTabIndex)
    const rafId = window.requestAnimationFrame(() => setHasMeasured(true))

    const observer = new ResizeObserver(() => {
      measureTabs(defaultActiveTabIndex)
    })

    observer.observe(navEl)
    for (const node of navEl.querySelectorAll(':scope > [data-tab-item]')) {
      observer.observe(node)
    }

    return () => {
      window.cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [defaultActiveTabIndex, items, measureTabs])

  const handleItemClick = useCallback(
    (index: number) => {
      const item = items[index]
      if (!item) return

      const key = getItemKey(item)
      onChange(key, item, index)
    },
    [onChange, items],
  )

  const translateX = `${metrics.offsets[defaultActiveTabIndex] ?? 0}px`

  return (
    <div data-testid='tabs' className={s.wrapper}>
      <nav ref={navRef} className={s.nav}>
        {items.map((item, index) => (
          <TabItem
            key={getItemKey(item)}
            activeKey={activeKey}
            index={index}
            item={item}
            size={size}
            slipBarPos={slipBarPos}
            topSpace={topSpace}
            bottomSpace={bottomSpace}
            variant={variant}
            onClick={handleItemClick}
          />
        ))}

        {hasActiveItem && (
          <span
            className={s.slipBar}
            style={{
              transform: `translate3d(${translateX}, 0, 0)`,
              width: `${metrics.widths[defaultActiveTabIndex] ?? 0}px`,
              transition: hasMeasured ? undefined : 'none',
            }}
          >
            <span
              className={s.realBar}
              style={{
                width: `${metrics.activeLabelWidth}px`,
                transition: hasMeasured ? undefined : 'none',
              }}
            />
          </span>
        )}
      </nav>
    </div>
  )
}

export default Tabs
