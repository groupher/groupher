import useTwBelt from '~/hooks/useTwBelt'

import useBase from '.'

export { cn, cnMerge } from '~/css'

export default () => {
  const { cnMerge } = useTwBelt()
  const base = useBase()

  return {
    wrapper: base.baseSection,
    blockActive: base.blockBaseActive,
    block: cnMerge(base.blockBase, 'w-72 h-44'),
    select: 'row-center gap-x-10 w-full h-auto',
    bar: cnMerge(base.bar, 'h-1.5 w-20 opacity-40'),
    layout: 'column-align-both group',

    cover: cnMerge(base.bar, 'h-20 ml-0.5 opacity-15 w-40 rounded-md'),
  }
}
