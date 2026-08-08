import SIZE from '~/constant/size'
import useTwBelt from '~/hooks/useTwBelt'
import type { TSizeSM } from '~/spec'

export { cn } from '~/css'

type TProps = {
  size: TSizeSM
  active: boolean
  disabled?: boolean
}

export default function useSalon({ size, active, disabled = false }: TProps) {
  const { bg, br, cn, fg, fill } = useTwBelt()

  const isSmall = size === SIZE.SMALL

  const item = cn(
    'inline-flex max-w-full items-center rounded-xl border cursor-pointer transition-[background-color,border-color,padding,min-width] duration-200 ease-out outline-none',
    'focus-visible:ring-2 focus-visible:ring-offset-1',
    br('divider'),
  )

  const itemActive = cn(
    bg('hoverBg'),
    'border',
    br('divider'),
    isSmall ? 'pl-0.5 pr-2.5 min-w-14' : 'pl-0.5 pr-3 min-w-16',
  )

  const itemInactive = cn(bg('hoverBg'), 'px-0.5')
  const itemDisabled = 'cursor-not-allowed opacity-50'
  const iconImage =
    'size-3.5 shrink-0 select-none transition-[filter,opacity] duration-200 ease-out'
  const iconComp = cn(
    'inline-flex size-4 shrink-0 items-center justify-center',
    'transition-[filter,opacity] duration-200 ease-out',
    fill('digest'),
    fg('digest'),
  )
  const label = cn(
    'overflow-hidden whitespace-nowrap text-xs bold-sm transition-[max-width,opacity,transform,margin] duration-200 ease-out',
    fg('title'),
  )

  return {
    itemClassName: cn(item, active ? itemActive : itemInactive, disabled && itemDisabled),
    iconSlot: cn('inline-flex shrink-0 items-center justify-center', isSmall ? 'size-7' : 'size-8'),
    iconImageClassName: cn(
      iconImage,
      active
        ? 'saturate-100 opacity-100'
        : 'saturate-0 opacity-70 hover:saturate-100 hover:opacity-100',
    ),
    iconCompClassName: cn(
      iconComp,
      active
        ? 'saturate-100 opacity-100'
        : 'saturate-0 opacity-70 hover:saturate-100 hover:opacity-100',
    ),
    labelClassName: cn(
      label,
      active
        ? isSmall
          ? 'ml-1 max-w-24 opacity-100 translate-x-0'
          : 'ml-1.5 max-w-28 opacity-100 translate-x-0'
        : 'ml-0 max-w-0 opacity-0 translate-x-1',
    ),
  }
}
