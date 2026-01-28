import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

import useBase from '.'

export default () => {
  const { cn, bg } = useTwBelt()
  const { link, menuLink, linkActive, arrowIcon } = useBase()

  return {
    wrapper: 'row-center gap-x-3.5 ml-1.5',
    menuPanel: cn('column w-36', bg('popover.bg')),
    link,
    menuLink,
    linkActive,
    arrowIcon,
    groupItem: 'relative pr-4',
  }
}
