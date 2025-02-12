import useTwBelt from '~/hooks/useTwBelt'

import useBase from '.'

export { cn } from '~/css'

export default () => {
  const { cn } = useTwBelt()
  const base = useBase()

  return {
    wrapper: base.baseSection,
    block: cn(base.blockBase, 'w-72 h-80'),
    blockActive: base.blockBaseActive,
    select: cn('row-center gap-x-10 w-full'),
    bar: cn(base.bar, 'h-1.5 w-20 opacity-40'),
    layout: 'column-align-both group',

    cover: cn(base.bar, 'h-20 ml-0.5 opacity-15 w-40 rounded-md'),
    thumbnil: cn(base.bar, 'w-12 h-10 ml-0.5 opacity-15rounded-md opacity-10'),
  }
}
