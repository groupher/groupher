import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    wrapper: cn('row-center-between w-full mt-8 mb-5'),
    block: 'column items-start w-1/5 pl-5',
    title: cn('text-sm bold', fg('text.digest')),
    desc: cn('text-xs mt-0.5', fg('text.hint')),
    num: cn('text-lg mt-1.5', fg('text.title')),
    trendChart: 'w-full mt-1.5 -ml-1',
    //
    iconBox: 'align-both size-7 circle mb-3.5 -ml-0.5',
    greenBg: rainbow(COLOR_NAME.GREEN, 'bgSoft'),
    blueBg: rainbow(COLOR_NAME.BLUE, 'bgSoft'),
    purpleBg: rainbow(COLOR_NAME.PURPLE, 'bgSoft'),
    orangeBg: rainbow(COLOR_NAME.ORANGE, 'bgSoft'),
    redBg: rainbow(COLOR_NAME.RED, 'bgSoft'),
    //
    icon: 'size-3.5',
    greenFill: rainbow(COLOR_NAME.GREEN, 'fill'),
    blueFill: rainbow(COLOR_NAME.BLUE, 'fill'),
    purpleFill: rainbow(COLOR_NAME.PURPLE, 'fill'),
    orangeFill: rainbow(COLOR_NAME.ORANGE, 'fill'),
    redFill: rainbow(COLOR_NAME.RED, 'fill'),
  }
}
