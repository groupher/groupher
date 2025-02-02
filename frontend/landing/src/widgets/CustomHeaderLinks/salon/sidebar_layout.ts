import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, primary, fill } = useTwBelt()

  const linkItem = cn(
    'row-center text-sm h-8 w-40 pl-1.5',
    `hover:${fg('text.title')}`,
    fg('text.digest'),
  )

  return {
    wrapper: 'gap-y-4 -ml-1',
    linkItem: cn(linkItem, `hover:${bg('hoverBg')}`),
    linkActive: cn(fg('text.title'), primary()),
    groupItem: cn(linkItem, 'relative', `hover:${bg('hoverBg')}`),
    groupItemActive: cn(bg('hoverBg')),
    menuPanel: cn(bg('popover.bg')),
    menuItem: cn(linkItem, `hover:${bg('menuHoverBg')}`),
    menuItemActive: cn(bg('menuHoverBg')),
    icon: cn('size-3.5 mr-3 ml-px', fill('text.digest')),
    arrowIcon: cn('size-3.5 absolute right-2 opacity-80 -rotate-90', fill('text.digest')),
  }
}
