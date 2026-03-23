import { BANNER_LAYOUT } from '~/const/layout'

import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export default function useSalon() {
  const { cn } = useTwBelt()
  const { main } = useBase()

  const { bannerLayout } = useLayout()

  return {
    wrapper: cn(
      'column-align-both',
      bannerLayout === BANNER_LAYOUT.HEADER && 'w-full ml-16 mt-7',
      bannerLayout === BANNER_LAYOUT.SIDEBAR && 'w-full ml-16 mt-7',
      bannerLayout === BANNER_LAYOUT.TABBER && 'w-full ml-4',
    ),
    cats: cn(
      main,
      'row wrap justify-between mt-2',
      bannerLayout === BANNER_LAYOUT.TABBER ? 'px-0' : 'pl-5 pr-14',
    ),
  }
}
