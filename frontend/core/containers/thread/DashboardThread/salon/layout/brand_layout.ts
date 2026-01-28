export { cn } from '~/css'

import useTwBelt from '~/hooks/useTwBelt'
import useBase from '.'

export default () => {
  const { cn, cnMerge, primary, isBlackPrimary, fg, fill, sexyBorder } = useTwBelt()
  const base = useBase()

  return {
    wrapper: base.baseSection,
    block: cnMerge(base.blockBase, 'w-44 h-20'),
    blockActive: base.blockBaseActive,
    select: 'row-center gap-x-10 w-full',
    brand: 'row-center',
    brandIcon: cn('size-6', primary('fill'), isBlackPrimary && fill('link')),
    brandTitle: cn('text-base', fg('digest')),
    layout: 'column-align-both group',
    layoutTitleActive: 'opacity-100',
    divider: cn(sexyBorder(), 'mt-4'),
  }
}
