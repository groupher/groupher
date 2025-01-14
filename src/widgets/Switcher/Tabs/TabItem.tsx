/*
 *
 * Tabs
 *
 */

import { type FC, useEffect, useCallback, useRef } from 'react'

import type { TSizeSM, TTabItem } from '~/spec'
import { Trans } from '~/i18n'
import { isString } from '~/validator'
import { isElementInViewport } from '~/dom'

import TabIcon from './TabIcon'
import useSalon, { cn } from '../salon/tabs/tab_item'

type TProps = {
  wrapMode?: boolean
  item: TTabItem
  index: number
  size: TSizeSM
  activeKey: string
  bottomSpace?: number | string
  setItemWidth?: (index: number, width: number) => void
  onClick?: (index: number, e) => void
}

const TabItem: FC<TProps> = ({
  wrapMode = false,
  bottomSpace = 0,
  activeKey,
  item,
  index,
  size,
  onClick,
  setItemWidth,
}) => {
  const active = item.slug === activeKey

  const s = useSalon({ bottomSpace })

  const ref = useRef(null)
  const clickableRef = useRef(null)
  const activeRef = useRef(null)

  // set each tab item width for calc
  useEffect(() => {
    const width = ref.current ? ref.current.offsetWidth : 0
    setItemWidth?.(index, width)
  }, [setItemWidth, index])

  const handleWrapperClick = useCallback(() => clickableRef.current.click(), [clickableRef])

  const handleLabelClick = useCallback(
    (e) => {
      e.stopPropagation()
      onClick(index, e)
    },
    [onClick, index],
  )

  useEffect(() => {
    if (item.slug === activeKey && !wrapMode) {
      const curEl = activeRef?.current
      const inViewport = isElementInViewport(curEl)

      // 这里的 width 是一个 hack, 每一个 TabItem 会触发设置宽度的
      // 父元素钩子，导致两次渲染，但是第一次没有调用之前每个 Item 的宽度是 auto
      // 利用这个特性可以判断真正需要 scroll 到 view 的元素
      if (curEl && inViewport && getComputedStyle(curEl).width !== 'auto') {
        curEl.scrollIntoView({
          block: 'center',
          // inline: 'center',
        })
      }
    }
  }, [activeRef, item, activeKey, wrapMode])

  return (
    <div className={s.wrapper} ref={ref} onClick={handleWrapperClick}>
      <span
        ref={clickableRef}
        className={cn(s.label, active && s.labelActive)}
        onClick={handleLabelClick}
      >
        {!isString(item) && item.icon && (
          <TabIcon item={item} clickableRef={clickableRef} active={item.slug === activeKey} />
        )}
        <div ref={item.slug === activeKey ? activeRef : null}>
          {isString(item) ? item : item.alias || Trans(item.title)}
        </div>
      </span>
    </div>
  )
}

export default TabItem
