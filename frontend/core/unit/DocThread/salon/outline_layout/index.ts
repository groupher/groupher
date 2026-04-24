import { COMMUNITY_LAYOUT } from '~/const/layout'

import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export default function useSalon() {
  const { cn } = useTwBelt()
  const { main } = useBase()

  const { communityLayout } = useLayout()

  return {
    wrapper: cn(
      'column-align-both',
      communityLayout === COMMUNITY_LAYOUT.CLASSIC && 'w-full ml-16 mt-7',
      communityLayout === COMMUNITY_LAYOUT.SIDEBAR && 'w-full ml-16 mt-7',
      communityLayout === COMMUNITY_LAYOUT.HERO && 'w-full ml-4',
    ),
    cats: cn(
      main,
      'row wrap justify-between mt-2',
      communityLayout === COMMUNITY_LAYOUT.HERO ? 'px-0' : 'pl-5 pr-14',
    ),
  }
}
