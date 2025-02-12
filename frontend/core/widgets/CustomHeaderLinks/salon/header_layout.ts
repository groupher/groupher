import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

import useBase from '.'

export default () => {
  const { cn, bg } = useTwBelt()
  const { link, menuLink, linkActive, arrowIcon } = useBase()

  return {
    wrapper: cn('row-center gap-x-3.5 ml-1.5'),
    menuPanel: cn('column w-36', bg('popover.bg')),
    link,
    menuLink,
    linkActive,
    arrowIcon,
    groupItem: cn('relative pr-4'),
  }
}
