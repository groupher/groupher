import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, rainbow, fill } = useTwBelt()

  const turnning = 'opacity-30 saturate-50'

  return {
    wrapper: cn('absolute w-full h-full top-0 left-0'),
    wipItem: cn(
      'row-center absolute left-1/2 top-28 -ml-32 rotate-3',
      rainbow(COLOR_NAME.GREEN, 'fg'),
    ),
    wipText: cn('text-lg bold opacity-30 ml-1', rainbow(COLOR_NAME.GREEN, 'fg')),
    wipIcon: cn('size-4 opacity-50 -mt-0.5', rainbow(COLOR_NAME.GREEN, 'fill')),

    versionText: cn(
      'absolute top-28 right-72 text-base bold opacity-40 -rotate-2',
      rainbow(COLOR_NAME.GREEN, 'fg'),
    ),

    thxText: cn(
      'absolute bottom-36 left-1/2 -ml-32 text-base bold opacity-25 rotate-2',
      rainbow(COLOR_NAME.GREEN, 'fg'),
    ),

    topicItem: cn(
      'row-center absolute left-20 bottom-32 -rotate-3',
      rainbow(COLOR_NAME.GREEN, 'fg'),
    ),

    waweLine: cn(
      'size-10 absolute -bottom-8 right-0 rotate-12 opacity-20 scale-y-50',
      rainbow(COLOR_NAME.ORANGE, 'fill'),
    ),

    curveLineTL: cn('absolute size-80 top-24 left-60', turnning),
    curveLineBL: cn('absolute size-80 bottom-20 left-60 ml-2', turnning),
    //
    curveLineTR: cn('absolute size-80 top-24 right-48', turnning),
    curveLineBR: cn('absolute size-80 bottom-20 right-44', turnning),
    fillPurple: rainbow(COLOR_NAME.PURPLE, 'fill'),
    fillDigest: fill('text.digest'),
    //
    shapeIcon: cn('size-5 absolute opacity-30'),
    fillGreen: rainbow(COLOR_NAME.GREEN, 'fill'),
    fillRed: rainbow(COLOR_NAME.RED, 'fill'),
    fillOrange: rainbow(COLOR_NAME.ORANGE, 'fill'),
    fillBlue: rainbow(COLOR_NAME.BLUE, 'fill'),
    squareIcon: cn('size-4 absolute rounded rotate-45 opacity-20', rainbow(COLOR_NAME.GREEN, 'bg')),
    circleIcon: cn(
      'size-4 circle border-4 absolute opacity-10',
      rainbow(COLOR_NAME.GREEN, 'border'),
    ),
  }
}
