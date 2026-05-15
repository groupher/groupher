import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export { cn } from '~/css'

export default function useSalon() {
  const { cn } = useTwBelt()
  const base = useBase()

  return {
    wrapper: base.baseSection,
    block: cn(base.blockBase, 'align-both h-60 w-full'),
    blockActive: base.blockBaseActive,
    select: 'grid w-full grid-cols-1 gap-8 lg:grid-cols-2 xl:grid-cols-3',
    layout: 'column-align-both min-w-0',
    divider: cn(base.divider, 'mt-14 mb-16'),

    bar: cn(base.bar, 'h-1.5 w-20 opacity-40'),
    circle: cn(base.circle, 'size-3.5 opacity-40'),
  }
}
