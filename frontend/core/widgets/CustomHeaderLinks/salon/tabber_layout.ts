import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, fill } = useTwBelt()

  const linkItem = cn(
    'row-center text-sm h-8 px-2 pointer rounded-lg',
    `hover:${fg('text.title')}`,
    fg('text.digest'),
  )

  return {
    wrapper: 'row-center gap-x-4',
    menuPanel: cn(bg('popover.bg')),
    linkItem: cn(linkItem, `hover:${bg('hoverBg')}`),
    groupItem: cn(linkItem, 'relative', `hover:${bg('hoverBg')}`),
    groupItemActive: cn(bg('hoverBg')),
    icon: cn('size-3.5 mr-1 ml-px', fill('text.digest')),
    arrowIcon: cn('size-3.5 ml-1 opacity-80 -rotate-90', fill('text.digest')),
  }
}
