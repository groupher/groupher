import type { TActive } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'
import useCommunityDigestViewport from '~/hooks/useCommunityDigestViewport'

type TProps = TActive

export default ({ active }: TProps) => {
  const { cn, fg, bg, br } = useTwBelt()
  const { inView: badgeInView } = useCommunityDigestViewport()

  return {
    wrapper: cn(
      'row-center group border border-transparent pointer rounded-md transition-colors',
      'gap-y-2.5 h-9 text-sm py-0.5 px-1.5 ',
      active ? 'pr-2 pl-2' : 'pl-3.5',
      badgeInView ? 'pl-3.5' : 'pl-2.5',
      active && bg('menuHoverBg'),
      active && br('divider'),
      active ? fg('text.title') : fg('text.digest'),

      `hover:${fg('text.title')}`,
      `hover:${br('divider')}`,
      `hover:${bg('menuHoverBg')}`,
    ),
  }
}
