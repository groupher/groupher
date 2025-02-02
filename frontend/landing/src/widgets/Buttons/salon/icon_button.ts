import type { TActive, TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  size: number
  dimWhenIdle: boolean
} & TSpace &
  TActive

export default ({ size, active, dimWhenIdle, ...spacing }: TProps) => {
  const { cn, zise, margin, fg, bg, fill } = useTwBelt()

  return {
    wrapper: cn('align-both relative', `hover:${bg('hoverBg')}`, zise(size), margin(spacing)),
    content: 'z-20',
    hint: cn('min-w-20 text-center px-1 py-1.5', fg('text.digest')),
    icon: cn(
      'pointer',
      dimWhenIdle ? 'opacity-80' : 'opacity-100',
      'hover:opacity-100',
      zise(size),
      fill(active ? 'text.title' : 'text.digest'),
    ),
  }
}
