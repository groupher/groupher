import { COMMUNITY_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'

/** Exposes sidebar layout state and actions through the shared React hook boundary. */
export default function useSidebarLayout(): boolean {
  const { communityLayout } = useLayout()

  return communityLayout === COMMUNITY_LAYOUT.SIDEBAR
}
