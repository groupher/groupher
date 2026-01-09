import useMobileDetect from '@groupher/use-mobile-detect-hook'
import { findIndex, includes, isEmpty, pluck } from 'ramda'
import { type FC, useCallback, useEffect, useRef, useState } from 'react'
import SIZE from '~/const/size'
import type { TSizeSM, TTabItem } from '~/spec'
import { isString } from '~/validator'
import useSalon from '../salon/tabs'
import TabItem from './TabItem'

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

    // mare sure the real bar animation starts only when this component fully loaded
    const timerId = setTimeout(() => setIsInitialRender(false), 500)

    return () => clearTimeout(timerId)
  }, [defaultActiveTabIndex])

  const handleNaviItemWith = useCallback((index, width) => {
    tabWidthListRef.current[index] = width
  }, [])

  const handleItemClick = useCallback(
    (index, e) => {
      const item = items[index]

      setSlipWidth(e.e.currentTarget.offsetWidth)
      setActive(index)
      onChange(isString(item) ? item : item.slug || item.title)
    },
    [onChange, items],
  )

  const translateX = `${
    tabWidthListRef.current.slice(0, active).reduce((a, b) => a + b, 0) +
    s.getSlipMargin(size, isMobile) * active
  }px`

  return (
    <div data-testid='tabs' className={s.wrapper}>
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
            className={s.slipBar}
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
