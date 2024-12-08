import { type FC, useCallback, useState, useRef, useEffect } from 'react'

import type { TTabItem } from '~/spec'
import { isString } from '~/validator'

import useSalon, { cn } from '../styles/tabs/drawer_view'

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

  useEffect(() => {
    const index = items.findIndex(
      (item) => (isString(item) ? item : item.slug || item.title) === activeKey,
    )
    setActiveIndex(index !== -1 ? index : 0)
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
            className={cn(s.tabItem, index === activeIndex && s.activeTabItem)}
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
