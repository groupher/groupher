import { COMMUNITY_LAYOUT, POST_LAYOUT } from '~/const/layout'

import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br } = useTwBelt()
  const { postLayout, communityLayout } = useLayout()

  const isSidebarLayout = communityLayout === COMMUNITY_LAYOUT.SIDEBAR
  const isClassicLayout = communityLayout === COMMUNITY_LAYOUT.CLASSIC
  const isHeroLayout = communityLayout === COMMUNITY_LAYOUT.HERO

  const isMasonary = postLayout === POST_LAYOUT.MASONRY

  return {
    wrapper: 'row w-full',
    layout: cn(
      isSidebarLayout && `min-w-0 flex-1 ${isMasonary ? 'px-[12%]' : 'px-[20%]'}`,
      isClassicLayout && `min-w-0 flex-1 mt-3 mr-12 pr-16 border-r ${br('divider')}`,
      isHeroLayout && 'min-w-0 flex-1 mt-3.5 mr-12',
    ),
  }
}
