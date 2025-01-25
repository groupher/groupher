import useBase from '..'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn } = useTwBelt()
  const base = useBase()

  return {
    wrapper: base.baseSection,
    block: cn(base.blockBase, 'align-both w-72 h-60'),
    blockActive: base.blockBaseActive,
    select: cn('row-center wrap gap-x-8 gap-y-8 w-full'),
    layout: 'column-align-both',
    divider: cn(base.divider, 'mt-14 mb-16'),

    bar: cn(base.bar, 'h-1.5 w-20 opacity-40'),
    circle: cn(base.circle, 'size-3.5 opacity-40'),
  }
}
