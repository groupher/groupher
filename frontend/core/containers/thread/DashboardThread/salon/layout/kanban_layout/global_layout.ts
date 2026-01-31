import useTwBelt from '~/hooks/useTwBelt'
import useBase from '..'

export { cn, cnMerge } from '~/css'

export default () => {
  const { cnMerge } = useTwBelt()
  const base = useBase()

  return {
    select: 'row-center wrap gap-x-5 gap-y-8 w-full',
    block: cnMerge(base.blockBase, 'h-48'),
    blockActive: base.blockBaseActive,
    layout: 'column-align-both',

    bar: cnMerge(base.bar, 'h-1.5 w-20 opacity-40'),
    board: 'bottom-0 w-20 h-36 opacity-10 rounded-lg rounded-b-none',
    item: 'h-7 w-16',
    circle: cnMerge(base.circle, 'opacity-40'),
  }
}
