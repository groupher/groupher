'use client'

import NextImage from 'next/image'
import { cloneElement, isValidElement, type FC, type ReactElement, type SVGProps } from 'react'

import useSalon, { cn } from '../salon/pill_tabs/tab_item'
import type { TPillTabItemProps } from './spec'
import { cnMerge } from '~/css'

const TabItem: FC<TPillTabItemProps> = ({
  item,
  index,
  active,
  size,
  itemClassName,
  onClick,
  onKeyDown,
}) => {
  const s = useSalon({ size, active, disabled: item.disabled })
  const iconCompElement = isValidElement(item.iconComp)
    ? (item.iconComp as ReactElement<SVGProps<SVGSVGElement>>)
    : null

  const renderedIconComp = iconCompElement
    ? cloneElement(iconCompElement, {
        className: cnMerge(s.iconCompClassName, iconCompElement.props.className),
        'aria-hidden': true,
      })
    : item.iconComp

  return (
    <button
      type='button'
      role='tab'
      aria-selected={active}
      aria-label={typeof item.label === 'string' ? item.label : undefined}
      disabled={item.disabled}
      tabIndex={active ? 0 : -1}
      className={cn(s.itemClassName, itemClassName)}
      onClick={() => onClick?.(index)}
      onKeyDown={(event) => onKeyDown?.(event, index)}
    >
      <span className={s.iconSlot} aria-hidden='true'>
        {item.icon ? (
          <NextImage
            src={item.icon}
            alt=''
            width={14}
            height={14}
            unoptimized
            draggable={false}
            className={s.iconImageClassName}
          />
        ) : (
          renderedIconComp
        )}
      </span>
      <span className={s.labelClassName}>{item.label}</span>
    </button>
  )
}

export default TabItem
