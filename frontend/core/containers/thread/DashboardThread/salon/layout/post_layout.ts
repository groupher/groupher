import useTwBelt from '~/hooks/useTwBelt'

import useBase from '.'

export { cn } from '~/css'

export default () => {
  const base = useBase()
  const { cn, avatar, primary } = useTwBelt()

  return {
    wrapper: base.baseSection,
    select: cn('row-center wrap gap-x-5 gap-y-8 w-full'),
    inline: 'inline-block',
    layout: 'column-center justify-between h-32',
    block: cn(base.blockBase, 'h-24 min-h-24'),
    blockActive: base.blockBaseActive,

    bar: cn(base.bar, 'h-1.5 w-20 opacity-40'),
    circle: cn(base.circle, 'opacity-40'),
    commentIcon: base.icon,
    upvoteIcon: cn(base.icon, 'size-4'),

    userAvatar: cn(base.bar, 'absolute left-4 top-6 size-6', avatar()),
    upvoteBtn: cn(
      'column-align-both absolute w-10 h-11 border rounded-lg text-xs',
      primary('borderSoft'),
      primary('fg'),
    ),
  }
}
