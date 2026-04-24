import { COMMUNITY_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn } = useTwBelt()
  const { communityLayout } = useLayout()

  return {
    wrapper: cn(COMMUNITY_LAYOUT.HERO === communityLayout && 'pl-2 pr-14'),
  }
}
