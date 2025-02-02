import { BANNER_LAYOUT } from '~/const/layout'

import useTwBelt from '~/hooks/useTwBelt'
import useLayout from '~/hooks/useLayout'

export default () => {
  const { cn } = useTwBelt()
  const { bannerLayout } = useLayout()

  return {
    wrapper: cn(BANNER_LAYOUT.TABBER === bannerLayout && 'pl-2 pr-14'),
  }
}
