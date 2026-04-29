'use client'

import { cloneElement, isValidElement, type FC, type ReactElement, type SVGProps } from 'react'

import useSalon, { cn } from '../salon/pill_tabs/tab_item'
import type { TPillTabItemProps } from './spec'

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
        className: cn(s.iconCompClassName, iconCompElement.props.className),
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
          <img src={item.icon} alt='' draggable={false} className={s.iconImageClassName} />
        ) : (
          renderedIconComp
        )}
      </span>
      <span className={s.labelClassName}>{item.label}</span>
    </button>
  )
}

export default TabItem
