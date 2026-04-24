import { COMMUNITY_LAYOUT } from '~/const/layout'

import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn } = useTwBelt()

  const { communityLayout } = useLayout()
  const isSidebarLayout = communityLayout === COMMUNITY_LAYOUT.SIDEBAR

  return {
    wrapper: cn('w-full', isSidebarLayout && 'row justify-between'),
    content: 'column w-full min-h-screen',
  }
}
