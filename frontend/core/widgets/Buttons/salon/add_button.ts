import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = {
  disabled: boolean
  dimWhenIdle: boolean
} & TSpace

export default function useSalon({ dimWhenIdle, disabled, ...spacing }: TProps) {
  const { cn, margin, fg, fill } = useTwBelt()

  return {
    wrapper: cn(
      'row-center relative group',
      'hover:opacity:100',
      'trans-all-200',
      dimWhenIdle || disabled ? 'opacity-65' : 'opacity-100',
      !disabled ? 'pointer' : 'cursor-not-allowed',
      margin(spacing),
    ),
    icon: cn('size-3 mr-0.5', fill('digest'), `group-hover:${fill('title')}`),
    text: cn('text-sm', fg('digest'), `group-hover:${fg('title')}`),
  }
}
