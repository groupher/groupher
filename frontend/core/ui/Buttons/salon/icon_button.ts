import useTwBelt from '~/hooks/useTwBelt'
import type { TActive, TSpace } from '~/spec'

type TProps = {
  size: number
  dimWhenIdle: boolean
} & TSpace &
  TActive

export default function useSalon({ size, active, dimWhenIdle, ...spacing }: TProps) {
  const { cn, zise, margin, fg, bg, fill } = useTwBelt()

  return {
    wrapper: cn('align-both relative', `hover:${bg('hoverBg')}`, zise(size), margin(spacing)),
    content: 'z-20',
    hint: cn('min-w-20 text-center px-1 py-1.5', fg('digest')),
    icon: cn(
      'pointer',
      dimWhenIdle ? 'opacity-80' : 'opacity-100',
      'hover:opacity-100',
      zise(size),
      fill(active ? 'title' : 'digest'),
    ),
  }
}
