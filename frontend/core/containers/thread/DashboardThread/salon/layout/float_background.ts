import useTwBelt from '~/hooks/useTwBelt'

import useBase from '.'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const base = useBase()
  const { cnMerge, shadow } = useTwBelt()

  return {
    wrapper: base.baseSection,
    blockActive: base.blockBaseActive,
    block: cnMerge(base.blockBase, 'row-center w-72 h-44 p-0'),
    select: 'row-center gap-x-10 w-full h-auto',
    bar: cnMerge(base.bar, 'h-2 opacity-40 z-10'),
    layout: 'column-align-both group',

    lightPanel: 'bg-white w-1/2 h-full top-0 left-0',
    darkPanel: 'bg-black w-1/2 h-full top-0 right-0 opacity-80',

    popover: cnMerge(
      'absolute h-20 opacity-95 w-30 rounded-md bg-black z-20 border border-dotted',
      shadow('md'),
    ),
  }
}
