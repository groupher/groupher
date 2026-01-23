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

export default ({
  disabled,
  checked,
  indeterminate,
  hiddenMode,
  dimWhenIdle,
  color,
  size,
  ...spacing
}: TProps) => {
  const { cn, margin, fg, fill, rainbow } = useTwBelt()
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
    input: cn(
      'sr-only',
      // 如果你不想用 sr-only，也可用 absolute opacity-0 等方案
      // 'absolute opacity-0 pointer-events-none'
    ),

    iconBox: cn(
      size === SIZE.SMALL ? 'size-3' : 'size-4',
      'align-both rounded trans-all-200 relative',
      disabled ? 'border-none' : 'border-2',
      active ? rainbow(color$, 'bg') : 'bg-transparent',
      rainbow(color$, 'border'),
    ),

    checkIcon: cn(
      size === SIZE.SMALL ? 'size-2.5' : 'size-3.5',
      checked ? fill('button.fg') : 'hidden',
    ),

    mixedIcon: cn(
      'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm',
      size === SIZE.SMALL ? 'h-[2px] w-2' : 'h-[2px] w-2.5',
      indeterminate && !checked ? fill('button.fg') : 'hidden',
    ),

    children: cn('size-sm ml-2', active ? fg('text.title') : fg('text.digest')),
  }
}
