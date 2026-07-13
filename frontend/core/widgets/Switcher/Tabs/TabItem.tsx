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
import { isString } from '~/validator'

import useSalon, { cn } from '../salon/tabs/tab_item'
import type { TTabItem, TTabItemProps } from './spec'
import TabIcon from './TabIcon'

const getItemKey = (item: TTabItem): string =>
  isString(item) ? item : item.slug || item.title || ''
const getItemHref = (item: TTabItem): string | undefined => (isString(item) ? undefined : item.href)

const TabItem: FC<TTabItemProps> = ({
  wrapMode = false,
  slipBarPos = 'bottom',
  topSpace = 0.5,
  bottomSpace = 0.5,
  variant = 'default',
  activeKey,
  item,
  index,
  size: _size, // 保留参数，样式系统可能用到
  onClick,
}) => {
  const key = getItemKey(item)
  const href = getItemHref(item)
  const active = key === activeKey

  const s = useSalon({ slipBarPos, topSpace, bottomSpace, variant })

  const { t } = useTrans()
  const activeRef = useRef<HTMLDivElement | null>(null)

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
          block: 'nearest',
          inline: 'center',
        })
      }
    }
  }, [activeKey, wrapMode, key])

  const Label = (
    <span data-tab-label='true' className={cn(s.label, active && s.labelActive)}>
      {!isString(item) && item.icon && <TabIcon item={item} active={active} />}
      <div ref={active ? activeRef : null}>
        {isString(item) ? item : (item.label ?? t(item.title as never))}
      </div>
    </span>
  )

  if (href) {
    return (
      <Link href={href} className={s.wrapper} data-tab-item='true' onClick={handleLabelClick}>
        {Label}
      </Link>
    )
  }

  return (
    <button type='button' className={s.wrapper} data-tab-item='true' onClick={handleLabelClick}>
      {Label}
    </button>
  )
}

export default TabItem
