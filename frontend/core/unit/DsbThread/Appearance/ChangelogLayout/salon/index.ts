import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../../../useDsbSalon'

export { cnMerge } from '~/css'

export default function useSalon() {
  const { cnMerge } = useTwBelt()
  const base = useBase()

  return {
    wrapper: base.section,
    block: cnMerge(base.card, 'w-72 h-80 p-5'),
    blockActive: base.cardActive,
    select: 'row-center gap-x-10 w-full',
    bar: cnMerge(base.bar, 'h-1.5 w-20 opacity-40'),
    layout: 'column-align-both group',

    frame: 'column s-full',

    classicList: 'column s-full justify-between',
    classicEntry: 'column gap-4',
    classicCover: cnMerge(base.bar, 'static h-20 w-40 self-center rounded-md opacity-15'),
    classicText: 'column w-40 self-center gap-2',
    classicTitle: cnMerge(base.bar, 'static h-2.5 w-14 opacity-30'),
    classicBodyWide: cnMerge(base.bar, 'static h-1.5 w-32 opacity-20'),
    classicBodyNarrow: cnMerge(base.bar, 'static h-1.5 w-28 opacity-10'),

    minimalList: 'column s-full justify-between',
    minimalListInner: 'mx-auto column s-full justify-between',
    minimalEntry: 'column-center w-full',
    minimalHeader: 'row-start w-2/3',
    minimalText: 'column gap-2.5',
    minimalMeta: cnMerge(base.bar, 'static h-1.5 w-7 opacity-20'),
    minimalTitle: cnMerge(base.bar, 'static h-2.5 w-20 opacity-30'),
    minimalBodyWide: cnMerge(base.bar, 'static h-1.5 w-28 opacity-30'),
    minimalBodyNarrow: cnMerge(base.bar, 'static h-1.5 w-24 opacity-20'),
    minimalBodyTiny: cnMerge(base.bar, 'static h-1.5 w-16 opacity-10'),
    minimalMain: 'column-start mx-auto gap-4',
    minimalThumbRow: 'row gap-2',
    minimalThumb: cnMerge(base.bar, 'static h-10 w-12 rounded-md opacity-10'),
  }
}
