import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, fill } = useTwBelt()

  const linkItem = cn(
    'row-center text-xs h-6 px-2 pointer rounded',
    `hover:${fg('text.title')}`,
    fg('text.digest'),
  )

  return {
    wrapper: 'row-center gap-x-2 h-4',
    linkItem,
    menuPanel: cn(bg('popover.bg')),
    groupItem: cn(linkItem, 'relative'),
    arrowIcon: cn('size-3 ml-1 opacity-80 -rotate-90', fill('text.digest')),
  }
}
