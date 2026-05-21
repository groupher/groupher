import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../../useAppearanceBaseSalon'

export { cnMerge } from '~/css'

export default function useSalon() {
  const { cn, cnMerge } = useTwBelt()
  const base = useBase()

  return {
    wrapper: base.baseSection,
    block: cn(base.blockBase, 'flex min-h-24 w-full items-center justify-center px-5 py-5'),
    blockActive: base.blockBaseActive,
    select: 'grid w-full grid-cols-1 gap-6 md:grid-cols-2',
    layout: 'flex min-w-0 flex-col items-stretch gap-3',

    previewList: 'flex w-full items-center justify-center gap-6',
    previewItem: 'flex min-w-0 items-center',

    bar: cnMerge(base.bar, 'ml-1.5 h-1.5 w-16 opacity-40'),
    circle: cnMerge(base.circle, 'size-3.5 shrink-0 opacity-40'),

    hashIcon: cnMerge(base.icon, 'size-5 shrink-0'),
  }
}
