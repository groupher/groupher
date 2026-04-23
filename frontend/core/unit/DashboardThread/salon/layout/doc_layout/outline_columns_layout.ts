import useTwBelt from '~/hooks/useTwBelt'

import useBaseSalon from './cover_thumb_base'

export default function useSalon() {
  const { cnMerge } = useTwBelt()
  const base = useBaseSalon()

  return {
    block: cnMerge(base.block, 'justify-center px-2.5'),
    grid: 'grid w-full grid-cols-3 items-start gap-6 h-full',
    column: 'column w-full min-w-0 gap-0 self-start overflow-hidden',
    centerColumn: 'column w-full min-w-0 gap-0 self-start overflow-hidden',
    rightColumn: 'column w-full min-w-0 gap-0 self-start overflow-hidden',
    group: 'column w-full min-w-0 gap-1.5',
    columnGap: 'h-4',
    titleLg: cnMerge(base.bar, 'h-1 w-8 opacity-40'),
    titleMd: cnMerge(base.bar, 'h-1 w-10 opacity-40'),
    titleSm: cnMerge(base.bar, 'h-1 w-4 opacity-40'),
    entry: 'flex w-full min-w-0 items-center gap-1.5 overflow-hidden',
    entryLabelLg: cnMerge(base.bar, 'h-1 w-6 shrink-0 opacity-22'),
    entryLabelMd: cnMerge(base.bar, 'h-1 w-5 shrink-0 opacity-20'),
    entryLine: cnMerge(base.bar, 'h-px min-w-0 grow opacity-12'),
    entryNum: cnMerge(base.bar, 'h-1 w-1.5 shrink-0 opacity-20'),
  }
}
