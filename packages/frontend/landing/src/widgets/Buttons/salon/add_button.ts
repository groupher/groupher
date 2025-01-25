import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  disabled: boolean
  dimWhenIdle: boolean
} & TSpace

export default ({ dimWhenIdle, disabled, ...spacing }: TProps) => {
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
    icon: cn('size-3 mr-0.5', fill('text.digest'), `group-hover:${fill('text.title')}`),
    text: cn('text-sm', fg('text.digest'), `group-hover:${fg('text.title')}`),
  }
}
