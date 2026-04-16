import { BANNER_LAYOUT } from '~/const/layout'

import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export default function useSalon() {
  const { cn } = useTwBelt()
  const { main } = useBase()

  const { globalLayout } = useLayout()

  return {
    wrapper: cn(
      'column-align-both',
      globalLayout === BANNER_LAYOUT.HEADER && 'w-full ml-16 mt-7',
      globalLayout === BANNER_LAYOUT.SIDEBAR && 'w-full ml-16 mt-7',
      globalLayout === BANNER_LAYOUT.TABBER && 'w-full ml-4',
    ),
    cats: cn(
      main,
      'row wrap justify-between mt-2',
      globalLayout === BANNER_LAYOUT.TABBER ? 'px-0' : 'pl-5 pr-14',
    ),
  }
}
