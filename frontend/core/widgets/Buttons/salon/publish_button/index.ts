import { COMMUNITY_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = TSpace

export default function useSalon({ ...spacing }: TProps) {
  const { cn, fg, margin, fill, bg } = useTwBelt()
  const { communityLayout } = useLayout()

  return {
    wrapper: cn('row-center', margin(spacing)),
    pubBtn: cn(
      'row-center w-full max-w-full p-1 rounded-xl overflow-hidden',
      bg('divider'),
      fg('button.fg'),
    ),
    mainBtn: 'min-w-flex',
    menuBtn: 'h-8 w-8 shrink-0',

    arrowBtn: 'h-full w-8',
    arrowIcon: cn('size-3 rotate-90 opacity-60', fill('button.fg')),
    menuOffset: communityLayout === COMMUNITY_LAYOUT.CLASSIC ? [-86, 0] : [-80, 4],
  }
}
