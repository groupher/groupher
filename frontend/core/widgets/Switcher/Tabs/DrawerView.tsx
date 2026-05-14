import { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { isString } from '~/validator'

import useSalon, { cn } from '../salon/tabs/drawer_view'
import type { TTabItem, TViewProps } from './spec'

const temItems: TTabItem[] = [
  {
    title: '帖子',
    slug: 'posts',
    localIcon: 'settings',
  },
]

const Tabs: FC<TViewProps> = ({
  onChange = () => {},
  items = temItems,
  activeKey = '',
  slipBarPos = 'bottom',
  topSpace = 0.5,
  bottomSpace = 0.5,
  ...spacing
}) => {
  const s = useSalon({ slipBarPos, topSpace, bottomSpace, ...spacing })
  const tabsRef = useRef<HTMLDivElement>(null)
  const [sliderStyle, setSliderStyle] = useState({})
  const activeIndex = useMemo(() => {
    const index = items.findIndex(
      (item) => (isString(item) ? item : item.slug || item.title) === activeKey,
    )

    return index !== -1 ? index : 0
  }, [activeKey, items])

  useEffect(() => {
    if (tabsRef.current) {
      const activeTab = tabsRef.current.children[activeIndex] as HTMLElement
      if (activeTab) {
        const { offsetLeft, offsetWidth } = activeTab
        setSliderStyle({
          transform: `translateX(${offsetLeft}px)`,
          width: `${offsetWidth}px`,
        })
      }
    }
  }, [activeIndex])

  const handleItemClick = useCallback(
    (item: TTabItem, index: number) => {
      onChange(isString(item) ? item : item.slug || item.title || '', item, index)
    },
    [onChange],
  )

  return (
    <div className={s.wrapper} data-testid='tabs'>
      <div className={s.tabsContainer} ref={tabsRef}>
        {items.map((item, index) => (
          <button
            type='button'
            key={isString(item) ? item : item.slug || item.title}
            className={cn(s.tabItem, index === activeIndex && s.activeTabItem)}
            onClick={() => handleItemClick(item, index)}
          >
            {isString(item) ? item : item.title}
          </button>
        ))}
      </div>
      <div className={s.slider} style={sliderStyle} />
    </div>
  )
}

export default Tabs
