import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export { cn } from '~/css'

export default () => {
  const { cn, br, bg, avatar } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn(
      'p-5 pl-7 rounded-md w-11/12 mt-7 border border-transparent',
      `hover:${br('divider')}`,
      bg('sandBox'),
    ),

    select: cn('row-center wrap w-full -ml-2'),
    block: cn(base.blockBase, 'w-72 h-24 scale-90'),
    blockActive: base.blockBaseActive,
    layout: 'column-align-both w-1/2',
    icon: cn(base.icon, 'size-5'),
    userAvatar: cn(base.bar, 'absolute size-4', avatar()),
    bar: cn(base.bar, 'h-1.5 w-20 opacity-40'),
    circle: cn(base.circle, 'opacity-40'),
  }
}
