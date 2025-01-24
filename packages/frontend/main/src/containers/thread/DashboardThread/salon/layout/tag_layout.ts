import useTwBelt from '~/hooks/useTwBelt'
import useBase from '.'

export { cn } from '~/css'

export default () => {
  const { cn } = useTwBelt()
  const base = useBase()

  return {
    wrapper: base.baseSection,
    block: cn(base.blockBase, 'align-both w-64 h-20'),
    blockActive: base.blockBaseActive,
    select: cn('row-center gap-x-8 w-full'),
    layout: 'column-align-both',

    bar: cn(base.bar, 'h-1.5 w-20 opacity-40'),
    circle: cn(base.circle, 'size-3.5 opacity-40'),

    hashIcon: cn(base.icon, 'size-5 absolute'),
  }
}
