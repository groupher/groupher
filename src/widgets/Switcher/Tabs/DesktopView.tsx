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
  const [isInitialRender, setIsInitialRender] = useState(true)

  const navRef = useRef(null)
  const tabWidthListRef = useRef([])

  useEffect(() => {
    if (navRef.current) {
      const activeSlipWidth =
        navRef.current.childNodes[defaultActiveTabIndex].firstElementChild.offsetWidth

      setSlipWidth(activeSlipWidth)
    }
    setActive(defaultActiveTabIndex)

    // mare sure the real bar animation starts only when this component fullly loaded
    const timerId = setTimeout(() => setIsInitialRender(false), 500)

    return () => clearTimeout(timerId)
  }, [defaultActiveTabIndex, hasActiveItem])

  const handleNaviItemWith = useCallback((index, width) => {
    tabWidthListRef.current[index] = width
  }, [])

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
    tabWidthListRef.current.slice(0, active).reduce((a, b) => a + b, 0) +
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
              width: `${tabWidthListRef.current[active]}px`,
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
