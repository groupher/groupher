import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = {
  disabled: boolean
  dimWhenIdle: boolean
} & TSpace

export default function useSalon({ dimWhenIdle, disabled, ...spacing }: TProps) {
  const { cn, margin, hover } = useTwBelt()

  return {
    wrapper: cn(
      'row-center relative group',
      'hover:opacity:100',
      'trans-all-200',
      dimWhenIdle || disabled ? 'opacity-65' : 'opacity-100',
      !disabled ? 'pointer' : 'cursor-not-allowed',
      margin(spacing),
    ),
    icon: cn('size-3 mr-0.5', hover('icon')),
    text: cn('text-sm', hover('fg')),
  }
}
