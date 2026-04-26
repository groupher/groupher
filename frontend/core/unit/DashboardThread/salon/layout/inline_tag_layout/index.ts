import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const { cn } = useTwBelt()
  const base = useBase()

  return {
    wrapper: base.baseSection,
    block: cn(base.blockBase, 'align-both w-44 h-14 gap-2'),
    blockActive: base.blockBaseActive,
    select: 'row-center gap-8 w-full wrap',
    layout: 'column-align-both',

    bar: cn(base.bar, 'h-1.5 w-20 opacity-40'),
    circle: cn(base.circle, 'size-3.5 opacity-40'),

    hashIcon: cn(base.icon, 'size-5 absolute'),
  }
}
