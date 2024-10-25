import type { TColorName, TSizeSM, TSpace } from '~/spec'
import SIZE from '~/const/size'

import usePrimaryColor from '~/hooks/usePrimaryColor'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  disabled: boolean
  checked: boolean
  dimWhenIdle: boolean
  hiddenMode: boolean
  size: TSizeSM
  color: TColorName | null
} & TSpace

export default ({
  disabled,
  checked,
  hiddenMode,
  dimWhenIdle,
  color,
  size,
  ...spacing
}: TProps) => {
  const { cn, margin, fg, fill, rainbow } = useTwBelt()

  const primaryColor = usePrimaryColor()

  const show = checked || !hiddenMode
  const color$ = color || primaryColor

  return {
    wrapper: cn(
      'row-center hover:opacity-100',
      show ? 'visible' : 'invisible',
      dimWhenIdle ? 'opacity-65' : 'opacity-100',
      disabled ? 'cursor-not-allowed' : 'pointer',
      margin(spacing),
    ),
    iconBox: cn(
      size === SIZE.SMALL ? 'size-3' : 'size-4',
      'align-both size-4 rounded trans-all-200',
      disabled ? 'border-none' : 'border',
      checked ? rainbow(color$, 'bg') : 'bg-transparent',
      rainbow(color$, 'border'),
    ),
    checkIcon: cn(
      size === SIZE.SMALL ? 'size-2.5' : 'size-3.5',
      checked ? fill('button.fg') : 'hidden',
    ),

    children: cn('size-sm ml-2', checked ? fg('text.title') : fg('text.digest')),
  }
}
