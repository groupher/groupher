import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, br, rainbow, shadow } = useTwBelt()

  return {
    wrapper: cn('align-both w-[460px] h-[500px] z-20', 'absolute bottom-10 -left-5'),
    BgBubble: cn(
      'size-44 absolute top-40 left-36 rounded-3xl',
      'animate-spin animate-infinite animate-duration-[10000ms]',
      'gradient-green',
    ),
    //
    lLine: 'absolute h-20 left-7 top-52 mt-2',
    rLine: 'absolute h-20 right-7 top-48 mt-1.5 rotate-180',
    //
    curveLT: 'absolute -top-20 left-5 w-52 h-80',
    dot: cn('absolute size-2 circle opacity-20', rainbow(COLOR_NAME.BROWN, 'bg')),
    //
    bot: cn(
      'absolute w-auto px-2.5 py-1 z-20 bold-sm rounded-md border',
      fg('digest'),
      'gradient-green',
      br('divider'),
      shadow('sm'),
    ),

    ai: cn(
      'absolute w-auto px-2.5 py-1 z-20 bold-sm rounded-md border',
      fg('digest'),
      'gradient-orange',
      br('divider'),
      shadow('sm'),
    ),
  }
}
