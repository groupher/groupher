import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../../../useDsbSalon'

export { cnMerge } from '~/css'

export default function useSalon() {
  const { cn, cnMerge } = useTwBelt()
  const base = useBase()

  return {
    wrapper: base.section,
    block: cnMerge(base.card, 'align-both w-full h-14 gap-2'),
    blockActive: base.cardActive,
    select: 'grid w-full grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3',
    layout: 'column-align-both w-full min-w-0',

    bar: cn(base.bar, 'h-1.5 w-20 opacity-40'),
    circle: cn(base.circle, 'size-3.5 opacity-40'),

    hashIcon: cn(base.icon, 'size-5 absolute'),
  }
}
