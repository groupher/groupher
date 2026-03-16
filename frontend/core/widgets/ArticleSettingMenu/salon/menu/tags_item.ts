import useTwBelt from '~/hooks/useTwBelt'

import useBase from '.'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, cut } = useTwBelt()
  const base = useBase()

  return {
    menuItem: base.menuItem,
    tagTitle: cn('mr-1', cut('w-12')),
    tagCount: cn('text-xs mt-px', fg('hint')),
    icon: base.icon,
  }
}
