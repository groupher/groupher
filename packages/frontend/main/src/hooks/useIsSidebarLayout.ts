import { BANNER_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'

export default (): boolean => {
  const { bannerLayout } = useLayout()

  return bannerLayout === BANNER_LAYOUT.SIDEBAR
}
