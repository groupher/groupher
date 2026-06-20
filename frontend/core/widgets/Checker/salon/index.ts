import SIZE from '~/const/size'
import usePrimaryColor from '~/hooks/usePrimaryColor'
import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName, TSizeSM, TSpace } from '~/spec'

type TProps = {
  disabled: boolean
  checked: boolean
  indeterminate: boolean
  dimWhenIdle: boolean
  hiddenMode: boolean
  size: TSizeSM
  color: TColorName | null
} & TSpace

export default function useSalon({
  disabled,
  checked,
  indeterminate,
  hiddenMode,
  dimWhenIdle,
  color,
  size,
  ...spacing
}: TProps) {
  const { cn, margin, fg, fill, bg, rainbow } = useTwBelt()
  const primaryColor = usePrimaryColor()

  const show = checked || indeterminate || !hiddenMode
  const color$ = color || primaryColor

  const active = checked || indeterminate

  return {
    wrapper: cn(
      'row-center hover:opacity-100 select-none',
      show ? 'visible' : 'invisible',
      dimWhenIdle ? 'opacity-65' : 'opacity-100',
      disabled ? 'cursor-not-allowed' : 'cursor-pointer',
      margin(spacing),
    ),

    // 让 input 语义存在，但视觉隐藏；仍可聚焦/可读屏/可键盘切换
    input: 'sr-only',

    iconBox: cn(
      size === SIZE.SMALL ? 'size-3' : 'size-4',
      'align-both rounded trans-all-200 relative',
      'border-2',
      disabled && 'opacity-70',
      active ? rainbow(color$, 'bg') : 'bg-transparent',
      rainbow(color$, 'border'),
    ),

    checkIcon: cn(
      size === SIZE.SMALL ? 'size-2.5' : 'size-3.5',
      checked ? fill('button.fg') : 'hidden',
    ),

    mixedIcon: cn(
      'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm',
      size === SIZE.SMALL ? 'h-px w-2' : 'h-px w-2.5',
      indeterminate && !checked ? bg('button.fg') : 'hidden',
    ),

    children: cn('size-sm ml-2', active ? fg('title') : fg('digest')),
  }
}
