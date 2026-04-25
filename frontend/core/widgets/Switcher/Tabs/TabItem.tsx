/*
 *
 * Tabs
 *
 */

'use client'

import Link from 'next/link'
import { type FC, type MouseEvent, useCallback, useEffect, useRef } from 'react'
import { isElementInViewport } from '~/dom'
import useTrans from '~/hooks/useTrans'
import type { TSizeSM, TTabItem } from '~/spec'
import { isString } from '~/validator'
import useSalon, { cn } from '../salon/tabs/tab_item'
import TabIcon from './TabIcon'

type TProps = {
  wrapMode?: boolean
  item: TTabItem
  index: number
  size: TSizeSM
  activeKey: string
  bottomSpace?: number | string
  setItemWidth?: (index: number, width: number) => void
  onClick?: (index: number, e: MouseEvent<HTMLElement>) => void
}

const getItemKey = (item: TTabItem): string => (isString(item) ? item : item.slug)
const getItemHref = (item: TTabItem): string | undefined => (isString(item) ? undefined : item.href)

const TabItem: FC<TProps> = ({
  wrapMode = false,
  bottomSpace = 0,
  activeKey,
  item,
  index,
  size: _size, // 保留参数，样式系统可能用到
  onClick,
  setItemWidth,
}) => {
  const key = getItemKey(item)
  const href = getItemHref(item)
  const active = key === activeKey

  const s = useSalon({ bottomSpace })

  const { t } = useTrans()
  const linkRef = useRef<HTMLAnchorElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const clickableRef = useRef<HTMLSpanElement | null>(null)
  const activeRef = useRef<HTMLDivElement | null>(null)

  // set each tab item width for calc
  useEffect(() => {
    const width = linkRef.current?.offsetWidth ?? buttonRef.current?.offsetWidth ?? 0
    setItemWidth?.(index, width)
  }, [setItemWidth, index])

  /**
   * 非 href：维持原行为（点 wrapper 等价于点 label）
   * href：交给 Link 自己处理导航，不要模拟 click/不要 preventDefault
   */
  const handleWrapperClick = useCallback(() => {
    if (href) return
    clickableRef.current?.click()
  }, [href])

  const handleLabelClick = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      // 关键：href 场景不能 stopPropagation，否则 Next Link 拦截不到 click，会变成整页刷新
      if (!href) e.stopPropagation()
      onClick?.(index, e)
    },
    [onClick, index, href],
  )

  useEffect(() => {
    if (key === activeKey && !wrapMode) {
      const curEl = activeRef?.current
      const inViewport = isElementInViewport(curEl)

      if (curEl && inViewport && getComputedStyle(curEl).width !== 'auto') {
        curEl.scrollIntoView({
          block: 'center',
        })
      }
    }
  }, [activeKey, wrapMode, key])

  const Label = (
    <span
      ref={clickableRef}
      className={cn(s.label, active && s.labelActive)}
      onClick={handleLabelClick}
    >
      {!isString(item) && item.icon && (
        <TabIcon item={item} clickableRef={clickableRef} active={active} />
      )}
      <div ref={active ? activeRef : null}>{isString(item) ? item : t(item.title)}</div>
    </span>
  )

  if (href) {
    return (
      <Link href={href} className={s.wrapper} ref={linkRef}>
        {Label}
      </Link>
    )
  }

  return (
    <button type='button' className={s.wrapper} ref={buttonRef} onClick={handleWrapperClick}>
      {Label}
    </button>
  )
}

export default TabItem
