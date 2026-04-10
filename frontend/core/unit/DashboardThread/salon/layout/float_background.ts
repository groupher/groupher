import useTwBelt from '~/hooks/useTwBelt'

import useBase from '.'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const base = useBase()
  const { cnMerge, shadow } = useTwBelt()

  return {
    wrapper: base.baseSection,
    blockActive: base.blockBaseActive,
    block: cnMerge(base.blockBase, 'row w-72 h-44 p-0 overflow-hidden'),
    select: 'row-center gap-x-10 w-full h-auto',
    bar: cnMerge(base.bar, 'static h-2 opacity-40 z-10'),
    layout: 'column-align-both group',

    panel: 'column-start h-full w-1/2 px-5 pt-5 gap-3',
    lightPanel: 'bg-white',
    darkPanel: 'bg-black opacity-80',
    panelTitle: 'w-20 h-2.5 opacity-20',
    panelShort: 'w-12 opacity-20',
    panelWide: 'w-20 opacity-20',
    panelMid: 'w-16 opacity-20',
    panelNarrow: 'w-12 opacity-20',
    panelWideDim: 'w-20 opacity-10',

    popover: cnMerge(
      'absolute h-20 opacity-95 w-30 rounded-md bg-black z-20 border border-dotted',
      shadow('md'),
    ),
    popoverBody: 'column-start px-5 pt-4 gap-2',
    popoverTitle: 'w-full opacity-30',
    popoverBodyWide: 'w-4/5 opacity-20',
    popoverBodyNarrow: 'w-1/2 opacity-20',
    popoverLight: 'bg-white',
    popoverDark: 'bg-black',
  }
}
