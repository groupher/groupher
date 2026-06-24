import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../../../useDsbSalon'

export { cnMerge } from '~/css'

export default function useSalon() {
  const { cnMerge } = useTwBelt()
  const base = useBase()

  return {
    wrapper: base.section,
    block: cnMerge(base.card, 'flex h-14 w-full items-center justify-center px-3 py-0'),
    blockActive: base.cardActive,
    select: 'grid w-full grid-cols-1 gap-6 md:grid-cols-3',
    layout: 'column-align-both min-w-0',

    previewList: 'flex w-full items-center justify-center gap-5',
    previewItem: 'flex min-w-0 items-center',

    bar: cnMerge(base.bar, 'ml-1.5 h-1.5 w-12 opacity-40'),
    circle: cnMerge(base.circle, 'size-3 shrink-0 opacity-40'),

    hashIcon: cnMerge(base.icon, 'size-4 shrink-0'),
  }
}
