import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../../useLayoutBaseSalon'

export { cnMerge } from '~/css'

export default function useSalon() {
  const { cnMerge, primary } = useTwBelt()
  const base = useBase()

  return {
    block: 'column s-full px-1 py-1 justify-center',
    items: 'grid w-full grid-cols-3 gap-x-5 gap-y-3',
    item: 'row-start gap-2.5',
    iconBox: 'align-both size-4 rounded -mt-0.5',
    icon: cnMerge('size-2.5', primary('fill')),
    copy: 'column gap-1',
    itemTitle: cnMerge(base.bar, 'static h-1 w-8 mb-0.5 opacity-50'),
    itemDesc: cnMerge(base.bar, 'static h-1 w-12 opacity-20'),
    itemDescWide: cnMerge(base.bar, 'static h-1 w-16 opacity-22'),
  }
}
