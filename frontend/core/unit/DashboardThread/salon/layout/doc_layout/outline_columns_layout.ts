import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export default function useSalon() {
  const { cnMerge } = useTwBelt()
  const base = useBase()

  return {
    block: 'column s-full px-2.5 py-3 justify-center',
    grid: 'grid w-full grid-cols-3 items-start gap-6 h-full',
    column: 'column w-full min-w-0 gap-0 self-start overflow-hidden',
    centerColumn: 'column w-full min-w-0 gap-0 self-start overflow-hidden',
    rightColumn: 'column w-full min-w-0 gap-0 self-start overflow-hidden',
    group: 'column w-full min-w-0 gap-1.5',
    columnGap: 'h-4',
    titleLg: cnMerge(base.bar, 'static h-1 w-8 opacity-40'),
    titleMd: cnMerge(base.bar, 'static h-1 w-10 opacity-40'),
    titleSm: cnMerge(base.bar, 'static h-1 w-4 opacity-40'),
    entry: 'flex w-full min-w-0 items-center gap-1.5 overflow-hidden',
    entryLabelLg: cnMerge(base.bar, 'static h-1 w-6 shrink-0 opacity-22'),
    entryLabelMd: cnMerge(base.bar, 'static h-1 w-5 shrink-0 opacity-20'),
    entryLine: cnMerge(base.bar, 'static h-px min-w-0 grow opacity-12'),
    entryNum: cnMerge(base.bar, 'static h-1 w-1.5 shrink-0 opacity-20'),
  }
}
