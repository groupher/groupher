import { COMMUNITY_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../../salon'

export default function useSalon() {
  const { cn } = useTwBelt()
  const { communityLayout } = useLayout()
  const base = useBase()

  return {
    wrapper: cn(
      'column-align-both w-full mt-7 ml-0',
      communityLayout === COMMUNITY_LAYOUT.HERO && 'mt-1.5 ml-12',
    ),
    cats: cn(
      base.main,
      'grid min-h-96 w-full content-start justify-start justify-items-start gap-7 px-0',
      'grid-cols-2 lg:grid-cols-3',
    ),
  }
}
