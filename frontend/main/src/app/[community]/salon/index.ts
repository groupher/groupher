import { BANNER_LAYOUT } from '~/const/layout'

import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn } = useTwBelt()

  const { globalLayout } = useLayout()
  const isSidebarLayout = globalLayout === BANNER_LAYOUT.SIDEBAR

  return {
    wrapper: cn('w-full', isSidebarLayout && 'row justify-between'),
    content: 'column w-full min-h-screen',
  }
}
