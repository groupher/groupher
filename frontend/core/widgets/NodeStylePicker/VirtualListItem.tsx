'use client'

import type { ComponentType } from 'react'

import useSalon from './salon/virtual_list_item'

type TProps<T> = {
  item: T
  active: boolean
  className: string
  activeClassName: string
  onClick?: (item: T) => void
  ItemContent: ComponentType<{ item: T; active: boolean }>
}

export default function VirtualListItem<T>({
  item,
  active,
  className,
  activeClassName,
  onClick,
  ItemContent,
}: TProps<T>) {
  const s = useSalon({ className, activeClassName, active })

  return (
    <button type='button' className={s.button} onClick={() => onClick?.(item)}>
      <ItemContent item={item} active={active} />
    </button>
  )
}
