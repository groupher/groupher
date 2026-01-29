'use client'

import useMobileDetect from '@groupher/use-mobile-detect-hook'
import { findIndex, isEmpty } from 'ramda'
import type { FC, MouseEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

import SIZE from '~/const/size'
import type { TSizeSM, TTabItem } from '~/spec'
import { isString } from '~/validator'

import useSalon from '../salon/tabs'
import TabItem from './TabItem'

const temItems: TTabItem[] = [
  {
    title: '帖子',
    slug: 'posts',
    icon: 'settings',
  },
]

const getItemKey = (item: TTabItem): string => (isString(item) ? item : item.slug || item.title)

const getDefaultActiveTabIndex = (items: readonly TTabItem[], activeKey: string): number => {
  if (isEmpty(activeKey)) return 0

  const index = findIndex((item) => activeKey === getItemKey(item), items as TTabItem[])
  return index >= 0 ? index : 0
}

type TProps = {
  items?: readonly TTabItem[]
  /**
   * onChange 不再负责路由跳转；仅用于副作用/埋点等
   */
  onChange?: (key: string, item: TTabItem, index: number) => void
  activeKey?: string
  size?: TSizeSM
  slipHeight?: 'px' | 1
  bottomSpace?: number
  noAnimation?: boolean
}

const Tabs: FC<TProps> = ({
  size = SIZE.MEDIUM,
  onChange = () => {},
  items = temItems,
  activeKey = '',
  slipHeight = 1,
  bottomSpace = 0,
  noAnimation = false,
}) => {
  const s = useSalon({ noAnimation, slipHeight })
  const { isMobile } = useMobileDetect()

  const defaultActiveTabIndex = getDefaultActiveTabIndex(items, activeKey)
  const hasActiveItem = items.some((it) => getItemKey(it) === activeKey)

  const [active, setActive] = useState(defaultActiveTabIndex)
  const [slipWidth, setSlipWidth] = useState(0)
  const [isInitialRender, setIsInitialRender] = useState(true)

  const navRef = useRef<HTMLElement | null>(null)
  const tabWidthListRef = useRef<number[]>([])

  useEffect(() => {
    const navEl = navRef.current
    if (navEl?.childNodes?.[defaultActiveTabIndex]) {
      const node = navEl.childNodes[defaultActiveTabIndex] as HTMLElement
      // TabItem 里会保证第一个元素是可测宽 wrapper
      const first = node.firstElementChild as HTMLElement | null
      setSlipWidth(first?.offsetWidth ?? 0)
    }

    setActive(defaultActiveTabIndex)

    // make sure the real bar animation starts only when this component fully loaded
    const timerId = window.setTimeout(() => setIsInitialRender(false), 500)
    return () => window.clearTimeout(timerId)
  }, [defaultActiveTabIndex])

  const handleNaviItemWidth = useCallback((index: number, width: number) => {
    tabWidthListRef.current[index] = width
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
    tabWidthListRef.current.slice(0, active).reduce((a, b) => a + b, 0) +
    s.getSlipMargin(size, isMobile) * active
  }px`

  return (
    <div data-testid='tabs' className={s.wrapper}>
      <nav ref={navRef as any} className={s.nav}>
        {items.map((item, index) => (
          <TabItem
            key={getItemKey(item)}
            activeKey={activeKey}
            index={index}
            item={item}
            size={size}
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
              width: `${tabWidthListRef.current[active] ?? 0}px`,
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
