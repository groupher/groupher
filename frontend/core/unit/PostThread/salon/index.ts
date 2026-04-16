import { BANNER_LAYOUT, POST_LAYOUT } from '~/const/layout'

import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br } = useTwBelt()
  const { postLayout, globalLayout } = useLayout()

  const isSidebarLayout = globalLayout === BANNER_LAYOUT.SIDEBAR
  const isHeaderLayout = globalLayout === BANNER_LAYOUT.HEADER
  const isTabberLayout = globalLayout === BANNER_LAYOUT.TABBER

  const isMasonary = postLayout === POST_LAYOUT.MASONRY

  return {
    wrapper: 'row w-full',
    layout: cn(
      isSidebarLayout && `min-w-0 flex-1 ${isMasonary ? 'px-[12%]' : 'px-[20%]'}`,
      isHeaderLayout && `min-w-0 flex-1 mt-3 mr-12 pr-16 border-r ${br('divider')}`,
      isTabberLayout && 'min-w-0 flex-1 mt-3.5 mr-12',
    ),
  }
}
