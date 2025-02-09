import { HEADER_LAYOUT } from '~/const/layout'

import useTwBelt from '~/hooks/useTwBelt'
import useHeaderLinks from '~/hooks/useHeaderLinks'

export { cn } from '~/css'

export default () => {
  const { cn, br, global } = useTwBelt()
  const { layout } = useHeaderLinks()

  const isFloat = layout === HEADER_LAYOUT.FLOAT

  return {
    // h-20 -> h-[74]
    wrapper: cn(
      'row-center w-full justify-between',
      isFloat ? 'h-20' : 'h-16',
      !isFloat && 'border-b border-transparent',
      global('sexy-border-20'),
      br('divider'),
    ),
  }
}
