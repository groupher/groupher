import useTwBelt from '~/hooks/useTwBelt'

import useBase from '.'

import useTopbar from '../../logic/useTopbar'

export { cn } from '~/css'

export default () => {
  const { cn, rainbow, fg } = useTwBelt()
  const base = useBase()

  const { bg: topbarBg } = useTopbar()

  return {
    wrapper: base.baseSection,
    block: cn(base.blockBase, 'align-both w-72 h-44'),
    blockActive: base.blockBaseActive,
    select: cn('row-center gap-x-8 w-full'),
    layout: 'column-align-both',

    bar: cn(base.bar, 'h-1.5 w-20 opacity-40'),
    circle: cn(base.circle, 'size-3.5 opacity-40'),
    topBar: cn(
      'row-center absolute top-0 left-0 h-1 w-full -mt-px rounded-tl-md rounded-tr-md',
      rainbow(topbarBg, 'bg'),
    ),

    bgWrapper: cn('row-center text-xs', fg('text.digest')),
    bgLabel: cn(
      'align-both size-8 circle border pointer ml-4 hover:opacity-80',
      rainbow(topbarBg, 'border'),
    ),

    theColor: cn('size-6 circle', rainbow(topbarBg, 'bg')),
  }
}
