import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../../useLayoutBaseSalon'

export { cnMerge } from '~/css'

export default function useSalon() {
  const { cn, cnMerge, fg } = useTwBelt()
  const base = useBase()

  return {
    block: 'column s-full px-5 py-5',
    bar: cnMerge(base.bar, 'static h-1.5 w-20 opacity-40'),
    icon: 'size-2.5',
    faqTitle: cn('text-xs', fg('title')),
    titleWrap: 'row-center justify-center w-full mb-8',
    collapseList: 'column-center gap-3 w-full grow',
    collapseItem: 'column gap-1.5 w-24',
    flatList: 'column gap-9 w-fit self-center pt-1',
    flatRow: 'row gap-6',
    flatBox: cnMerge(
      base.box,
      'column gap-1.5 border-none w-14 h-auto p-0 bg-transparent shadow-none',
    ),
    leftRightMain: 'row-start gap-8 w-full grow pt-2',
    leftRightSide: 'column-start gap-1.5 w-20 pt-1',
    leftRightList: 'column gap-3.5 grow',
    leftRightItem: 'column gap-1.5 w-24',
  }
}
