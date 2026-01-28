import { COLOR_NAME } from '~/const/colors'
import { THREAD } from '~/const/thread'
import useTwBelt from '~/hooks/useTwBelt'
import GuideSVG from '~/icons/Book'
import DiscussSVG from '~/icons/DiscussSolid'
import KanbanSVG from '~/icons/Kanban'
import TadaSVG from '~/icons/Tada'

export { cn } from '~/css'

export default () => {
  const { cn, fg, rainbow, vividDark } = useTwBelt()

  return {
    wrapper: 'align-both w-full gap-x-20 relative',
    tabItem: cn(
      'column-align-both relative group w-44 border-b-2 border-b-transparent pb-5',
      'smoky-80 saturate-0 hover:saturate-100',
    ),
    tabActive: 'saturate-100 opacity-100',

    arrowIcon: 'size-12 absolute -top-0.5 -left-16 opacity-40 scale-y-75 animate-pulse',
    spinIcon: cn(
      'size-7 absolute top-2 -left-14 animate-spin animate-infinite animate-duration-[10000ms]',
    ),

    fillBlue: rainbow(COLOR_NAME.BLUE, 'fill'),
    fillOrange: rainbow(COLOR_NAME.ORANGE, 'fill'),
    fillCyan: rainbow(COLOR_NAME.CYAN, 'fill'),

    purpleBorder: rainbow(COLOR_NAME.PURPLE, 'border'),
    blueBorder: rainbow(COLOR_NAME.BLUE, 'border'),
    redBorder: rainbow(COLOR_NAME.RED, 'border'),
    cyanBorder: rainbow(COLOR_NAME.CYAN, 'border'),

    purpleBg: rainbow(COLOR_NAME.PURPLE, 'bgSoft'),
    blueBg: rainbow(COLOR_NAME.BLUE, 'bgSoft'),
    redBg: rainbow(COLOR_NAME.RED, 'bgSoft'),
    cyanBg: rainbow(COLOR_NAME.CYAN, 'bgSoft'),

    purpleFill: rainbow(COLOR_NAME.PURPLE, 'fill'),
    blueFill: rainbow(COLOR_NAME.BLUE, 'fill'),
    redFill: rainbow(COLOR_NAME.RED, 'fill'),
    cyanFill: rainbow(COLOR_NAME.CYAN, 'fill'),

    //
    title: cn('text-lg mb-1.5 mt-4 trans-all-100', `group-hover:${fg('title')}`, fg('digest')),
    titleActive: cn('bold', fg('title')),

    desc: cn('text-sm group-smoky-80', fg('digest')),
    descActive: '!opacity-100',

    //
    iconBox: 'size-10 rounded-md relative border border-dotted trans-all-200',
    icon: cn('size-7 absolute', vividDark()),
  }
}

export const ICON = {
  [THREAD.POST]: DiscussSVG,
  [THREAD.KANBAN]: KanbanSVG,
  [THREAD.CHANGELOG]: TadaSVG,
  [THREAD.DOC]: GuideSVG,
}
