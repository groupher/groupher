import { includes } from 'ramda'
import { COMMUNITY_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = TSpace

export default function useSalon({ ...spacing }: TProps) {
  const { cn, margin, fg, bg, br, fill } = useTwBelt()
  const { communityLayout } = useLayout()
  const { isLightTheme } = useTheme()

  const normalWrapper = cn('row-center', margin(spacing))
  const withBgWrapper = cn(
    'row-center border h-8 w-44 rounded-lg px-2 py-1.5 pointer shadow-md',
    br('divider'),
    bg('alphaBg'),
    margin(spacing),
  )

  const isHeroLayout = communityLayout === COMMUNITY_LAYOUT.HERO
  const wrapper = includes(communityLayout, [COMMUNITY_LAYOUT.SIDEBAR])
    ? withBgWrapper
    : normalWrapper

  return {
    wrapper,
    hoverBox: cn(
      'align-both size-6 rounded border border-transparent pointer',
      isHeroLayout && bg('hoverBg'),
      `hover:${bg('hoverBg')}`,
      `hover:${br('divider')}`,
    ),
    nickname: cn('text-sm ml-2.5', fg('digest')),
    unLoginIcon: cn('size-3 pointer', fill('digest'), `hover:${fill('title')}`),

    loadingBox: cn('size-4 rounded animate-pulse', isLightTheme ? bg('divider') : bg('digest')),
  }
}
