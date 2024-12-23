import useTwBelt from '~/hooks/useTwBelt'

import useBase from '.'

export { cn } from '~/css'

export default () => {
  const { cn, fg, cutRest } = useTwBelt()
  const base = useBase()

  return {
    menuItem: base.menuItem,
    tagTitle: cn('mr-1', cutRest('w-12')),
    tagCount: cn('text-xs mt-px', fg('text.hint')),
    icon: base.icon,
  }
}
