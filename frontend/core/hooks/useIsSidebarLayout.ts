import { COMMUNITY_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'

export default function useSidebarLayout(): boolean {
  const { communityLayout } = useLayout()

  return communityLayout === COMMUNITY_LAYOUT.SIDEBAR
}
