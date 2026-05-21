import useTwBelt from '~/hooks/useTwBelt'

import useTopbar from '../../../logic/useTopbar'
import useBase from '../../useLayoutBaseSalon'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, rainbow, fg } = useTwBelt()
  const base = useBase()

  const { bg: topbarBg } = useTopbar()

  return {
    wrapper: base.baseSection,
    block: cn(base.blockBase, 'column w-72 h-56 overflow-hidden px-4 pb-3 pt-0'),
    blockActive: base.blockBaseActive,
    select: 'row-center gap-x-8 w-full',
    layout: 'column-align-both relative overflow-hidden',
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
