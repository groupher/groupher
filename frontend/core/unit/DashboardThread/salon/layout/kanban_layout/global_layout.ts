import useTwBelt from '~/hooks/useTwBelt'
import useBase from '..'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const { cnMerge, bg } = useTwBelt()
  const base = useBase()

  return {
    select: 'row-center wrap gap-x-5 gap-y-8 w-full',
    block: cnMerge(base.blockBase, 'h-48 px-5 pt-5 pb-0'),
    blockActive: base.blockBaseActive,
    layout: 'column-align-both',

    frame: 'flex h-full w-full flex-col gap-5',
    toolbar: 'flex items-center justify-between',
    toolbarLeft: 'w-12',
    toolbarRight: 'w-6 opacity-30',

    bar: cnMerge(base.bar, 'static h-1.5 w-20 opacity-40'),
    boardGrid: 'grid min-h-0 flex-1 grid-cols-3 items-end gap-2.5',
    boardColumn: cnMerge(
      'mt-auto flex h-36 min-h-0 flex-col justify-start self-end rounded-lg rounded-b-none px-2 pt-2.5',
      bg('alphaBg'),
    ),
    boardContent: 'flex min-h-0 flex-col gap-2',
    card: cnMerge(base.bar, 'static h-7 w-full rounded'),

    waterfall: 'flex min-h-0 flex-1 flex-col gap-4',
    waterfallGroup: 'flex flex-col gap-2.5',
    waterfallRow: 'flex items-center justify-between gap-4',
    waterfallMain: cnMerge(base.bar, 'static flex h-3.5 items-center rounded-lg px-4 opacity-10'),
    waterfallTitle: cnMerge(base.bar, 'static h-1.5 rounded'),
    waterfallMeta: cnMerge(base.bar, 'static h-1.5 rounded opacity-20'),
  }
}
