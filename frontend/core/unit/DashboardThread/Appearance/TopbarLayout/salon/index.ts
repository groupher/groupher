import useTwBelt from '~/hooks/useTwBelt'

import useTopbar from '../../../logic/useTopbar'
import useBase from '../../useAppearanceBaseSalon'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, cnMerge, rainbow, fg } = useTwBelt()
  const base = useBase()

  const { bg: topbarBg } = useTopbar()

  return {
    wrapper: base.baseSection,
    block: cnMerge(base.blockBase, 'column w-full h-56 overflow-hidden px-4 pb-3 pt-0'),
    blockActive: base.blockBaseActive,
    select: 'grid w-full grid-cols-1 gap-8 md:grid-cols-2',
    layout: 'column-align-both relative w-full min-w-0 overflow-hidden',
    topBar: cn(
      'absolute top-0 left-0 h-1 w-full rounded-tl-md rounded-tr-md z-10',
      rainbow(topbarBg, 'bg'),
    ),

    bgWrapper: cn('row-center text-xs', fg('digest')),
    bgLabel: cn(
      'align-both size-8 circle border pointer ml-4 hover:opacity-80',
      rainbow(topbarBg, 'border'),
    ),

    theColor: cn('size-6 circle', rainbow(topbarBg, 'bg')),
  }
}
