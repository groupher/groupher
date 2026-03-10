import { BANNER_LAYOUT, POST_LAYOUT } from '~/const/layout'

import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, br } = useTwBelt()
  const { postLayout, bannerLayout } = useLayout()

  const isSidebarLayout = bannerLayout === BANNER_LAYOUT.SIDEBAR
  const isHeaderLayout = bannerLayout === BANNER_LAYOUT.HEADER
  const isTabberLayout = bannerLayout === BANNER_LAYOUT.TABBER

  const isMasonary = postLayout === POST_LAYOUT.MASONRY

  return {
    wrapper: 'row w-full',
    filter: 'row-center h-10 -ml-1.5',
    layout: cn(
      isSidebarLayout && `min-w-0 flex-1 ${isMasonary ? 'px-[12%]' : 'px-[20%]'}`,
      isHeaderLayout && `min-w-0 flex-1 mt-3 mr-12 pr-16 border-r ${br('divider')}`,
      isTabberLayout && 'min-w-0 flex-1 mt-3.5 mr-12',
    ),
  }
}
