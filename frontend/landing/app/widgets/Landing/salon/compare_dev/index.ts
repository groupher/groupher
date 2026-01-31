import { COLOR } from '~/const/colors'

import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { isDarkTheme } = useTheme()
  const { cn, fg, br, rainbow, rainbowSoft, landingTitle } = useTwBelt()

  return {
    wrapper: 'column align-both w-full mt-36',
    slogan: 'column align-both mb-10',
    topping: cn('text-xs border mb-3 px-3.5 py-1.5 rounded-lg', fg('title'), br('divider')),
    title: landingTitle(),
    desc: cn('text-lg mt-3', fg('digest'), isDarkTheme && 'opacity-65'),
    //
    ourWall: 'relative column-align-both w-full h-auto pl-10 overflow-hidden',
    ourWallBg: cn(
      'absolute top-0 left-0 s-full rotate-180 gradient-green',
      isDarkTheme && 'opacity-30 rotate-180',
    ),
    greenDiffBar: 'diff-bar-green absolute left-0 top-0 w-7 h-full z-10 rounded-tr-lg',
    redDiffBar: 'diff-bar-red absolute left-0 top-0 w-7 h-full z-10 rounded-br-lg',
    ourlabel: cn(
      'row-center absolute right-16 top-0 text-lg px-3 py-1 rounded-b-xl',
      rainbow(COLOR.GREEN, 'bgSoft'),
      rainbow(COLOR.GREEN, 'fg'),
    ),

    theirWall: 'relative column-align-both w-full h-auto diff-area-red-stripes',
    theirWallBg: cn(
      'absolute top-0 left-0 s-full',
      rainbowSoft(COLOR.RED),
      isDarkTheme ? 'opacity-80' : 'opacity-40',
    ),
    theirlabel: cn(
      'row-center absolute right-16 top-0 text-lg px-3 py-1 rounded-b-xl',
      rainbow(COLOR.RED, 'bgSoft'),
      rainbow(COLOR.RED, 'fg'),
    ),

    checkIcon: 'size-4 mr-2',
    fillGreen: rainbow(COLOR.GREEN, 'fill'),
    fillRed: rainbow(COLOR.RED, 'fill'),
  }
}
