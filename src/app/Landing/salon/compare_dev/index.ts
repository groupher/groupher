import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, br, global, rainbow } = useTwBelt()

  return {
    wrapper: cn('column align-both w-full mt-36 mb-24'),
    slogan: 'column align-both mb-10',
    tips: cn('text-xs border mb-2.5 px-3.5 py-0.5', fg('text.title'), br('divider')),
    title: cn('text-3xl bold-sm opacity-70', fg('text.title'), global('text-shadow')),
    desc: cn('text-lg mt-3', fg('text.digest')),
    //
    ourWall: cn('relative column-align-both w-full h-auto pl-10 overflow-hidden'),
    ourWallBg: cn('absolute top-0 left-0 w-full h-full rotate-180', global('gradient-green')),
    ourlabel: cn(
      'row-center absolute right-16 top-0 text-lg px-3 py-1 rounded-b-xl',
      rainbow(COLOR_NAME.GREEN, 'bgSoft'),
      rainbow(COLOR_NAME.GREEN, 'fg'),
    ),

    theirWall: cn('relative column-align-both w-full h-auto'),
    theirWallBg: cn('absolute top-0 left-0 w-full h-full rotate-180', global('gradient-red')),
    theirlabel: cn(
      'row-center absolute right-16 top-0 text-lg px-3 py-1 rounded-b-xl',
      rainbow(COLOR_NAME.RED, 'bgSoft'),
      rainbow(COLOR_NAME.RED, 'fg'),
    ),

    checkIcon: 'size-4 mr-2',
    fillGreen: rainbow(COLOR_NAME.GREEN, 'fill'),
    fillRed: rainbow(COLOR_NAME.RED, 'fill'),
  }
}
