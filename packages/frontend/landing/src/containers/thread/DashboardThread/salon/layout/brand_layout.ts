export { cn } from '~/css'

import useTwBelt from '~/hooks/useTwBelt'
import useBase from '.'

export default () => {
  const { cn, primary, isBlackPrimary, fg, fill, sexyBorder } = useTwBelt()
  const base = useBase()

  return {
    wrapper: base.baseSection,
    block: cn(base.blockBase, 'w-44 h-20'),
    blockActive: base.blockBaseActive,
    select: cn('row-center gap-x-10 w-full'),
    brand: 'row-center',
    brandIcon: cn('size-6', primary('fill'), isBlackPrimary && fill('text.link')),
    brandTitle: cn('text-base bold-sm', primary('fg'), isBlackPrimary && fg('text.link')),
    layout: 'column-align-both group',
    layoutTitleActive: cn('opacity-100'),
    divider: cn(sexyBorder(), 'mt-4'),
  }
}
