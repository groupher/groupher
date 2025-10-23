import { HEADER_LAYOUT } from '~/const/layout'
import useHeaderLinks from '~/hooks/useHeaderLinks'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, br } = useTwBelt()
  const { layout } = useHeaderLinks()

  const isFloat = layout === HEADER_LAYOUT.FLOAT

  return {
    // h-20 -> h-[74]
    wrapper: cn(
      'row-center w-full justify-between sexy-border-20',
      isFloat ? 'h-20' : 'h-16',
      !isFloat && 'border-b border-transparent',
      br('divider'),
    ),
  }
}
