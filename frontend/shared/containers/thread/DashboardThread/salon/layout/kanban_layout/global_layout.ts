import useTwBelt from '~/hooks/useTwBelt'
import useBase from '..'

export { cn } from '~/css'

export default () => {
  const { cn } = useTwBelt()
  const base = useBase()

  return {
    select: cn('row-center wrap gap-x-5 gap-y-8 w-full'),
    block: cn(base.blockBase, 'h-48'),
    blockActive: base.blockBaseActive,
    layout: 'column-align-both',

    bar: cn(base.bar, 'h-1.5 w-20 opacity-40'),
    board: 'bottom-0 w-20 h-36 opacity-10 rounded-lg rounded-b-none',
    item: 'h-7 w-16',
    circle: cn(base.circle, 'opacity-40'),
  }
}
