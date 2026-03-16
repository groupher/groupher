import useTwBelt from '~/hooks/useTwBelt'
import useBase from '.'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const { cn, cnMerge, cut, primary, sexyBorder, sexyVBorder } = useTwBelt()
  const base = useBase()

  return {
    wrapper: base.baseSection,
    select: 'row-center wrap gap-8 w-full',
    layout: 'group button-reset column-align-both',
    block: cnMerge(base.blockBase, 'relative h-56'),
    blockActive: base.blockBaseActive,
    communityTitle: cn('text-xs bold-sm', cut('w-14'), primary('fg')),
    primaryBar: cn('opacity-65', primary('bg')),
    bar: base.bar,
    circle: base.circle,

    hDivider: sexyBorder(),
    vDivider: cn('absolute', sexyVBorder(35)),
  }
}
