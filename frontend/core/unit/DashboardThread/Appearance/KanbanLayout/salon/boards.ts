import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../../useAppearanceBaseSalon'

export default function useSalon() {
  const { cn, cnMerge, hover } = useTwBelt()
  const base = useBase()

  return {
    select: 'row-center wrap gap-x-5 gap-y-8 w-full',
    block: cn('row-center wrap pointer px-1 py-0.5', hover('box')),
    box: 'size-4 align-both rounded trans-all-200 relative border-2',
    blockActive: base.blockBaseActive,

    bar: cnMerge(base.bar, 'h-1.5 w-20 opacity-40'),
    board: 'bottom-0 w-20 h-36 opacity-10 rounded-lg rounded-b-none',
    item: 'h-7 w-16',
    circle: cnMerge(base.circle, 'opacity-40'),
  }
}
