import { COLOR_NAME } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fill, fg, menu, rainbow, vividDark } = useTwBelt()

  const blockColor =
    'absolute top-0 left-0 w-full h-full -z-10 opacity-60 group-hover:opacity-100 trans-all-100'

  return {
    wrapper: cn('align-both w-full gap-x-4'),
    block: cn(
      'group column relative min-w-60 w-60 h-28 px-3 py-4 rounded-md pointer overflow-hidden',
      'trans-all-200',
    ),
    blockPurple: cn(blockColor, 'gradient-purple'),
    blockBlue: cn(blockColor, 'gradient-blue'),
    blockRed: cn(blockColor, 'gradient-red'),
    blockCyan: cn(blockColor, 'gradient-cyan'),
    head: 'row-center',

    title: cn('text-base ml-2', fg('text.title'), vividDark()),
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
