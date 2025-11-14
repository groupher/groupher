import { COLOR_NAME } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fill, fg, br, menu, rainbow, vividDark } = useTwBelt()

  return {
    wrapper: cn('align-both w-full gap-x-4'),
    block: cn(
      'group column -mt-4 relative min-w-52 w-52 h-32 px-3 py-2 rounded-md pointer overflow-hidden',
      'trans-all-200',
    ),
    head: 'row-center',

    title: cn('text-base', fg('text.title'), vividDark()),
    content: cn('column gap-y-1 border-l pl-2 mt-2 ml-0.5', br('text.digest')),
    item: cn('text-sm trans-all-200 line-clamp-1', fg('text.digest'), `hover:${fg('text.title')}`),
    more: cn('text-xs mt-0.5 ml-0.5 trans-all-200', fg('link'), `hover:${fg('text.title')}`),
    desc: cn('text-sm mt-3 trans-all-200 line-clamp-2', fg('text.digest')),

    purple: `group-hover:${rainbow(COLOR_NAME.PURPLE, 'fg')}`,
    blue: `group-hover:${rainbow(COLOR_NAME.BLUE, 'fg')}`,
    red: `group-hover:${rainbow(COLOR_NAME.RED, 'fg')}`,
    cyan: `group-hover:${rainbow(COLOR_NAME.CYAN, 'fg')}`,

    purpleIcon: `group-hover:${rainbow(COLOR_NAME.PURPLE, 'fill')}`,
    blueIcon: `group-hover:${rainbow(COLOR_NAME.BLUE, 'fill')}`,
    redIcon: `group-hover:${rainbow(COLOR_NAME.RED, 'fill')}`,
    cyanIcon: `group-hover:${rainbow(COLOR_NAME.CYAN, 'fill')}`,

    menuIcon: cn('size-4.5', fill('text.digest')),
    menuBarColumn: cn('column !items-start py-2'),
    menuTitle: cn(menu('title')),
    menuDesc: cn('text-xs mt-1 pr-1 opacity-80', fg('text.digest')),
  }
}
