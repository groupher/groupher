import useTwBelt from '~/hooks/useTwBelt'

import useBase from '.'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, cut } = useTwBelt()
  const base = useBase()

  return {
    menuItem: base.menuItem,
    tagTitle: cn('mr-1', cut('w-12')),
    tagCount: cn('pretty-num mt-px text-xs', fg('hint')),
    icon: base.icon,
  }
}
