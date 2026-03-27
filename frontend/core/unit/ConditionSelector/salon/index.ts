import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = { menuOpen?: boolean; selected?: boolean } & TSpace

export default function useSalon({ menuOpen, selected, ...spacing }: TProps) {
  const { cn, fg, bg, margin } = useTwBelt()

  return {
    wrapper: cn(
      'row-center rounded-lg h-8 py-0.5 transition-colors',
      `hover:${bg('hoverBg')}`,
      selected && 'mx-1',
      fg('digest'),
      (menuOpen || selected) && bg('hoverBg'),
      margin(spacing),
    ),
    //
  }
}
