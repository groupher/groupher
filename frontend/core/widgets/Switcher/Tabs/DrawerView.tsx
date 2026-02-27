import { type FC, useCallback, useEffect, useRef, useState } from 'react'

import type { TTabItem } from '~/spec'
import { isString } from '~/validator'

import useSalon, { cn } from '../salon/tabs/drawer_view'

const temItems = [
  {
    title: '帖子',
    localIcon: 'settings',
  },
]

type TProps = {
  items?: TTabItem[]
  onChange: (key: string) => void
  activeKey?: string
}

const Tabs: FC<TProps> = ({ onChange = console.log, items = temItems, activeKey = '' }) => {
  const s = useSalon()
  const [activeIndex, setActiveIndex] = useState(0)
  const tabsRef = useRef<HTMLDivElement>(null)
  const [sliderStyle, setSliderStyle] = useState({})
  const controlledActiveIndex = items.findIndex(
    (item) => (isString(item) ? item : item.slug || item.title) === activeKey,
  )
  const currentActiveIndex =
    activeKey ? (controlledActiveIndex !== -1 ? controlledActiveIndex : 0) : activeIndex

  useEffect(() => {
    if (tabsRef.current) {
      const activeTab = tabsRef.current.children[currentActiveIndex] as HTMLElement
      if (activeTab) {
        const { offsetLeft, offsetWidth } = activeTab
        setSliderStyle({
          transform: `translateX(${offsetLeft}px)`,
          width: `${offsetWidth}px`,
        })
      }
    }
  }, [currentActiveIndex])

  const handleItemClick = useCallback(
    (item, index) => {
      setActiveIndex(index)
      onChange(isString(item) ? item : item.slug || item.title)
    },
    [onChange],
  )

  return (
    <div className={s.wrapper} data-testid="tabs">
      <div className={s.tabsContainer} ref={tabsRef}>
        {items.map((item, index) => (
          <div
            key={isString(item) ? item : item.slug || item.title}
            className={cn(s.tabItem, index === currentActiveIndex && s.activeTabItem)}
            onClick={() => handleItemClick(item, index)}
          >
            {item.title}
          </div>
        ))}
      </div>
      <div className={s.slider} style={sliderStyle} />
    </div>
  )
}

export default Tabs
