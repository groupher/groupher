import { COLOR } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    wrapper: 'row-between w-full mt-8 mb-5',
    block: 'column items-start w-1/5 pl-5',
    title: cn('text-sm bold', fg('digest')),
    desc: cn('text-xs mt-0.5', fg('hint')),
    num: cn('text-lg mt-1.5', fg('title')),
    trendChart: 'w-full mt-1.5 -ml-1',
    //
    iconBox: 'align-both size-7 circle mb-3.5 -ml-0.5',
    greenBg: rainbow(COLOR.GREEN, 'bgSoft'),
    blueBg: rainbow(COLOR.BLUE, 'bgSoft'),
    purpleBg: rainbow(COLOR.PURPLE, 'bgSoft'),
    orangeBg: rainbow(COLOR.ORANGE, 'bgSoft'),
    redBg: rainbow(COLOR.RED, 'bgSoft'),
    //
    icon: 'size-3.5',
    greenFill: rainbow(COLOR.GREEN, 'fill'),
    blueFill: rainbow(COLOR.BLUE, 'fill'),
    purpleFill: rainbow(COLOR.PURPLE, 'fill'),
    orangeFill: rainbow(COLOR.ORANGE, 'fill'),
    redFill: rainbow(COLOR.RED, 'fill'),
  }
}
