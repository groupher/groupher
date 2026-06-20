import { COLOR } from '~/const/colors'
import { THREAD } from '~/const/thread'
import useTwBelt from '~/hooks/useTwBelt'
import GuideSVG from '~/icons/Book'
import DiscussSVG from '~/icons/DiscussSolid'
import KanbanSVG from '~/icons/Kanban'
import TadaSVG from '~/icons/Tada'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, rainbow, vividDark } = useTwBelt()

  return {
    wrapper: 'align-both w-full gap-x-20 relative',
    tabItem: cn(
      'column-align-both relative group w-44 border-b-2 border-b-transparent pb-5',
      'smoky-80 saturate-0 hover:saturate-100',
    ),
    tabActive: 'saturate-100 opacity-100',

    arrowIcon: 'size-12 absolute -top-0.5 -left-16 opacity-40 scale-y-75 animate-pulse',
    spinIcon: 'size-7 absolute top-2 -left-14 animate-spin animate-infinite animate-duration-[10000ms]',

    fillBlue: rainbow(COLOR.BLUE, 'fill'),
    fillOrange: rainbow(COLOR.ORANGE, 'fill'),
    fillCyan: rainbow(COLOR.CYAN, 'fill'),

    purpleBorder: rainbow(COLOR.PURPLE, 'border'),
    blueBorder: rainbow(COLOR.BLUE, 'border'),
    redBorder: rainbow(COLOR.RED, 'border'),
    cyanBorder: rainbow(COLOR.CYAN, 'border'),

    purpleBg: rainbow(COLOR.PURPLE, 'bgSoft'),
    blueBg: rainbow(COLOR.BLUE, 'bgSoft'),
    redBg: rainbow(COLOR.RED, 'bgSoft'),
    cyanBg: rainbow(COLOR.CYAN, 'bgSoft'),

    purpleFill: rainbow(COLOR.PURPLE, 'fill'),
    blueFill: rainbow(COLOR.BLUE, 'fill'),
    redFill: rainbow(COLOR.RED, 'fill'),
    cyanFill: rainbow(COLOR.CYAN, 'fill'),

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
