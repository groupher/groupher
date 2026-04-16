import { BANNER_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'

export default function useSidebarLayout(): boolean {
  const { globalLayout } = useLayout()

  return globalLayout === BANNER_LAYOUT.SIDEBAR
}
