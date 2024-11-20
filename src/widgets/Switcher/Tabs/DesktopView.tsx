/*
 *
 * Tabs
 *
 */

import { type FC, useEffect, useRef, useState, useCallback } from 'react'
import { isEmpty, findIndex, pluck, includes } from 'ramda'
import useMobileDetect from '@groupher/use-mobile-detect-hook'

import type { TSizeSM, TTabItem } from '~/spec'
import SIZE from '~/const/size'
import { isString } from '~/validator'

import TabItem from './TabItem'
import useSalon from '../styles/tabs'
import { getSlipMargin } from '../styles/metric/tabs'

const temItems = [
  {
    title: '帖子',
    slug: 'posts',
    icon: 'settings',
  },
]

/**
 * get default active key in tabs array
 * if not found, return 0 as first
 *
 * @param {array of string or object} items
 * @param {string} activeKey
 * @returns number
 */
const getDefaultActiveTabIndex = (items: TTabItem[], activeKey: string): number => {
  if (isEmpty(activeKey)) return 0
  const index = findIndex((item) => {
    return activeKey === (item.slug || item.title)
  }, items)

  return index >= 0 ? index : 0
}

type TProps = {
  items?: TTabItem[]
  onChange: () => void
  activeKey?: string
  size: TSizeSM
  slipHeight: 'px' | 1
  bottomSpace?: number
  noAnimation?: boolean
}

const Tabs: FC<TProps> = ({
  size = SIZE.MEDIUM,
  onChange = console.log,
  items = temItems,
  activeKey = '',
  slipHeight = 1,
  bottomSpace = 0,
  noAnimation = false,
}) => {
  const s = useSalon({ noAnimation, slipHeight })

  const { isMobile } = useMobileDetect()

  const defaultActiveTabIndex = getDefaultActiveTabIndex(items, activeKey)
  // @ts-ignore
  const hasActiveItem: boolean = includes(activeKey, pluck('slug', items))

  const [active, setActive] = useState(defaultActiveTabIndex)
  const [slipWidth, setSlipWidth] = useState(0)
  const [tabWidthList, setTabWidthList] = useState([])

  const navRef = useRef(null)

  // set initial slipbar with of active item
  // 给 slipbar 设置一个初始宽度
  useEffect(() => {
    if (navRef.current) {
      const activeSlipWidth =
        navRef.current.childNodes[defaultActiveTabIndex].firstElementChild.offsetWidth

      setSlipWidth(activeSlipWidth)
    }
    setActive(defaultActiveTabIndex)
  }, [defaultActiveTabIndex, hasActiveItem])

  // set slipbar with for current nav item
  // 为下面的滑动条设置当前 TabItem 的宽度
  const handleNaviItemWith = useCallback(
    (index, width) => {
      tabWidthList[index] = width
      setTabWidthList(tabWidthList)
    },
    [tabWidthList],
  )

  const handleItemClick = useCallback(
    (index, e) => {
      const item = items[index]

      setSlipWidth(e.target.offsetWidth)
      setActive(index)
      onChange(isString(item) ? item : item.slug || item.title)
    },
    [setSlipWidth, setActive, onChange, items],
  )

  const translateX = `${
    tabWidthList.slice(0, active).reduce((a, b) => a + b, 0) +
    getSlipMargin(size, isMobile) * active
  }px`

  return (
    <div data-testid="tabs" className={s.wrapper}>
      <nav ref={navRef} className={s.nav}>
        {items.map((item, index) => (
          <TabItem
            key={isString(item) ? item : item.slug || item.title}
            activeKey={activeKey}
            index={index}
            item={item}
            size={size}
            bottomSpace={bottomSpace}
            setItemWidth={handleNaviItemWith}
            onClick={handleItemClick}
          />
        ))}

        {hasActiveItem && (
          <span
            className={s.slipbar}
            style={{
              transform: `translate3d(${translateX}, 0, 0)`,
              width: `${tabWidthList[active]}px`,
            }}
          >
            <span className={s.realBar} style={{ width: `${slipWidth}px` }} />
          </span>
        )}
      </nav>
    </div>
  )
}

export default Tabs
