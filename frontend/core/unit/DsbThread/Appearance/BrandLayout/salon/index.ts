export { cn } from '~/css'

import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../../../useDsbSalon'

export default function useSalon() {
  const { cn, cnMerge, primary, fg, sexyBorder } = useTwBelt()
  const base = useBase()

  return {
    wrapper: base.section,
    block: cnMerge(base.card, 'w-full h-20'),
    blockActive: base.cardActive,
    select: 'grid w-full grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3',
    brand: 'row-center min-w-0',
    brandIcon: cn('size-6', primary('fill')),
    brandTitle: cn('min-w-0 truncate text-base', fg('digest')),
    layout: 'column-align-both group w-full min-w-0',
    layoutTitleActive: 'opacity-100',
    divider: cn(sexyBorder(), 'mt-4'),
  }
}
