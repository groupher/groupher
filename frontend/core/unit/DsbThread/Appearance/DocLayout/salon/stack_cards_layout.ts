import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../../../useDsbSalon'

export { cnMerge } from '~/css'

export default function useSalon() {
  const { cnMerge, bg, br } = useTwBelt()
  const base = useBase()

  return {
    block: 'column s-full px-2 py-1 justify-center',
    cardsRows: 'column w-full gap-4',
    cardsRow: 'grid w-full grid-cols-3 gap-3 justify-items-start',
    cardBox: cnMerge(
      'column justify-between w-full max-w-[5rem] rounded-md border p-2',
      br('divider'),
      bg('card'),
    ),
    cardBody: 'column gap-1.5',
    cardFooter: 'row-center justify-center h-3 rounded opacity-10',
    cardFooterBar: cnMerge(base.bar, 'h-1 w-8 opacity-30'),
    bar: cnMerge(base.bar, 'static h-1.5 w-20 opacity-40'),
  }
}
