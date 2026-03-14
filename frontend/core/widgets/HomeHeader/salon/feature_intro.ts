import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fill, hover, bg, fg, menu, rainbow, rainbowSoft, vividDark } = useTwBelt()

  const blockBase = 'relative align-both size-12 min-w-12 mr-4 rounded-lg'
  const blockBg = 'absolute top-0 left-0 s-full rounded-lg trans-all-100'
  const blockColor = cn(blockBg, 'opacity-0 group-hover:opacity-100')
  const iconColor = 'group-hover:opacity-100 trans-all-100'

  return {
    wrapper: 'align-both w-full gap-x-4',
    block: cn(
      'row group relative min-w-72 w-72 h-28 px-3 pt-5 rounded-lg pointer overflow-hidden',
      hover('bg'),
      'items-start',
    ),
    iconBlock: blockBase,
    blockGrey: cn(blockBg, 'opacity-100 group-hover:opacity-0', bg('sandBox')),
    blockPurple: cn(blockColor, rainbowSoft(COLOR.PURPLE)),
    blockBlue: cn(blockColor, rainbowSoft(COLOR.BLUE)),
    blockRed: cn(blockColor, rainbowSoft(COLOR.RED)),
    blockCyan: cn(blockColor, rainbowSoft(COLOR.CYAN)),
    head: 'column',

    title: cn('text-sm', fg('title'), vividDark()),
    desc: cn(
      'text-sm mt-2 trans-all-200 line-clamp-2',
      fg('digest'),
      `group-hover:${fg('title')}`,
      'group-hover:opacity-80',
    ),

    purpleIcon: cn(iconColor, `group-hover:${rainbow(COLOR.PURPLE, 'fill')}`),
    blueIcon: cn(iconColor, `group-hover:${rainbow(COLOR.BLUE, 'fill')}`),
    redIcon: cn(iconColor, `group-hover:${rainbow(COLOR.RED, 'fill')}`),
    cyanIcon: cn(iconColor, `group-hover:${rainbow(COLOR.CYAN, 'fill')}`),

    menuIcon: cn('size-6 z-10 opacity-65', fill('digest')),
    menuBarColumn: 'column !items-start py-2',
    menuTitle: cn(menu('title')),
    menuDesc: cn('text-xs mt-1 pr-1 opacity-80', fg('digest')),
  }
}
