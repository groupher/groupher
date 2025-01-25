import { BANNER_LAYOUT } from '~/const/layout'

import useBase from '..'

import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()
  const { bannerLayout } = useLayout()
  const base = useBase()

  return {
    wrapper: cn(
      'column-align-both w-full mt-7 ml-0',
      bannerLayout === BANNER_LAYOUT.TABBER && 'mt-1.5 ml-12',
    ),
    cats: cn(base.main, 'row justify-center wrap min-h-96 gap-7 px-0 w-fit'),
  }
}
