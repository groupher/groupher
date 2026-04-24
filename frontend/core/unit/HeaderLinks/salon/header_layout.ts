import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

import useBase from '.'

export default function useSalon() {
  const { cn, bg } = useTwBelt()
  const { link, menuLink, linkActive, menuLinkActive, arrowIcon } = useBase()

  return {
    wrapper: 'row-center gap-x-3.5 ml-1.5',
    menuPanel: cn('column w-36', bg('popover.bg')),
    link,
    menuLink,
    linkActive,
    menuLinkActive,
    arrowIcon,
    groupItem: 'relative pr-4',
  }
}
