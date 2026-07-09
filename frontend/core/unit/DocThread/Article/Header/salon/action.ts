import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, bg, br, fg, fill, hover, menu, primary, shadow } = useTwBelt()

  return {
    actionBtn: cn('row-center min-w-20 gap-1 pl-1 py-1 text-sm', hover('bg')),
    actionIcon: cn('size-3.5', hover('icon')),
    actionText: hover('fg'),
    actionArrow: cn('size-2.5 -ml-0.5 -rotate-90 group-smoky-0', hover('icon')),
    menuPanel: cn('w-80 rounded-lg border p-2', menu('bg'), br('divider'), shadow('md')),
    shareMenuPanel: 'w-72',
    menuItem: cn('group/menubar row w-full rounded-md px-2.5 py-2 text-left', menu('bar')),
    menuIconBox: cn('align-both size-9 min-w-9 rounded-md border mr-3', bg('card'), br('divider')),
    menuIcon: cn('size-4.5', fill('digest'), `group-hover/menubar:${primary('fill')}`),
    menuText: 'column min-w-0 items-start',
    menuTitle: cn('row-center gap-1 text-sm bold-sm', fg('title')),
    menuExternalIcon: cn('size-3 opacity-60', fill('digest')),
    menuDesc: cn('mt-0.5 text-xs leading-4', fg('digest')),
  }
}
