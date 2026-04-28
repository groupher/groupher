'use client'

import useMobileDetect from '@groupher/use-mobile-detect-hook'
import { findIndex, isEmpty } from 'ramda'
import type { FC, MouseEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

import SIZE from '~/const/size'
import { isString } from '~/validator'

import useSalon from '../salon/tabs'
import TabItem from './TabItem'
import type { TTabItem, TViewProps } from './spec'

const temItems: TTabItem[] = [
  {
    title: '帖子',
    slug: 'posts',
    icon: 'settings',
  },
]

const getItemKey = (item: TTabItem): string => (isString(item) ? item : item.slug || item.title || '')

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
  ...spacing
}) => {
  const s = useSalon({ noAnimation, slipHeight, slipBarPos, ...spacing })
  const { isMobile } = useMobileDetect()

  const defaultActiveTabIndex = getDefaultActiveTabIndex(items, activeKey)
  const hasActiveItem = items.some((it) => getItemKey(it) === activeKey)

  const [active, setActive] = useState(defaultActiveTabIndex)
  const [slipWidth, setSlipWidth] = useState(0)
  const [tabWidths, setTabWidths] = useState<number[]>([])
  const [isInitialRender, setIsInitialRender] = useState(true)

  const navRef = useRef<HTMLElement | null>(null)

  const measureTabs = useCallback(() => {
    const navEl = navRef.current
    if (!navEl) return

    const widths = Array.from(navEl.children).map((node) => (node as HTMLElement).offsetWidth ?? 0)
    setTabWidths((prev) =>
      prev.length === widths.length && prev.every((width, index) => width === widths[index])
        ? prev
        : widths,
    )

    const activeNode = navEl.children[defaultActiveTabIndex] as HTMLElement | undefined
    const activeWidth = getTabLabelWidth(activeNode)

    if (activeWidth > 0) {
      setSlipWidth(activeWidth)
    }
  }, [defaultActiveTabIndex])

  useEffect(() => {
    setActive(defaultActiveTabIndex)
    measureTabs()

    const timerId = window.setTimeout(() => setIsInitialRender(false), 500)
    return () => window.clearTimeout(timerId)
  }, [defaultActiveTabIndex, measureTabs])

  useEffect(() => {
    const navEl = navRef.current
    if (!navEl) return

    const rafId = window.requestAnimationFrame(() => {
      measureTabs()
    })

    const observer = new ResizeObserver(() => {
      measureTabs()
    })

    observer.observe(navEl)
    Array.from(navEl.children).forEach((node) => observer.observe(node))

    return () => {
      window.cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [items, measureTabs])

  const handleNaviItemWidth = useCallback((index: number, width: number) => {
    setTabWidths((prev) => {
      if (prev[index] === width) return prev
      const next = [...prev]
      next[index] = width
      return next
    })
  }, [])

  const handleItemClick = useCallback(
    (index: number, e: MouseEvent<HTMLElement>) => {
      const item = items[index]
      if (!item) return

      const key = getItemKey(item)
      const width = (e.currentTarget as HTMLElement).offsetWidth

      setSlipWidth(width)
      setActive(index)
      onChange(key, item, index)
    },
    [onChange, items],
  )

  const translateX = `${
    tabWidths.slice(0, active).reduce((a, b) => a + b, 0) +
    s.getSlipMargin(size, isMobile) * active
  }px`

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
            setItemWidth={handleNaviItemWidth}
            onClick={handleItemClick}
          />
        ))}

        {hasActiveItem && (
          <span
            className={s.slipBar}
            style={{
              transform: `translate3d(${translateX}, 0, 0)`,
              width: `${tabWidths[active] ?? 0}px`,
              transition: isInitialRender ? 'none' : undefined,
            }}
          >
            <span
              className={s.realBar}
              style={{
                width: `${slipWidth}px`,
                transition: isInitialRender ? 'none' : undefined,
              }}
            />
          </span>
        )}
      </nav>
    </div>
  )
}

export default Tabs
