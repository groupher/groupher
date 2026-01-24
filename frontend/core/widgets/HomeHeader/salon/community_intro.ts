import { COLOR_NAME } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fill, fg, hover, menu, rainbow, vividDark } = useTwBelt()

  return {
    wrapper: cn('align-both w-full gap-x-4'),
    block: cn(
      'group column relative min-w-52 w-52 h-28 px-3 py-4 rounded-md pointer overflow-hidden',
      hover('bg'),
      'items-start',
    ),
    head: 'row-center',

    title: cn('text-sm ml-2', fg('text.title'), vividDark()),
    desc: cn(
      'text-sm mt-3 trans-all-200 line-clamp-2',
      fg('text.digest'),
      `group-hover:${fg('text.title')}`,
      'group-hover:opacity-80',
    ),

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
