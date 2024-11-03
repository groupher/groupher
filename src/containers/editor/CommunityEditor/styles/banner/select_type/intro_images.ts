import useTwBelt from '~/hooks/useTwBelt'
import { COLOR_NAME } from '~/const/colors'

export { cn } from '~/css'

export default () => {
  const { cn, bg, br, shadow, rainbow, global, fill } = useTwBelt()

  const boxBase = cn(
    'absolute border p-0.5 alian-both rounded-lg',
    bg('card'),
    br('divider'),
    shadow('xl'),
  )

  return {
    wrapper: cn(
      'column absolute left-0 bottom-0 w-full h-36 opacity-80 trans-jump',
      'scale-90 group-hover:opacity-100',
    ),
    active: 'bottom-1 opacity-100 scale-95',
    imageBox: cn('size-24 -rotate-3 left-10 bottom-10', boxBase),

    cinemaImage: cn('size-24 -rotate-3 left-10 bottom-12 z-30', boxBase),
    codeImage: cn('size-20 -rotate-6 left-2 bottom-3', boxBase),
    adminsImage: cn('w-28 h-24 rotate-2 right-3 bottom-1 z-20', boxBase),
    image: 'rounded-lg w-full h-full object-cover',

    //
    gameBox: cn('size-20 absolute bg-transparent z-20'),
    gameImage: cn('w-full h-full object-cover', shadow('md')),
    gameBar: cn('w-32 h-3 rounded-md absolute -z-10', rainbow(COLOR_NAME.ORANGE, 'bg')),
    //

    // teach
    teachImage: cn('absolute size-24 left-1 bottom-12 z-30 saturate-50'),
    chartImage: cn('absolute size-20 -rotate-3 right-4 bottom-14 z-20 opacity-80', boxBase, 'p-1'),
    users: 'absolute bottom-2 left-2 scale-90 opacity-65',

    //
    pillsWrapper: 'row-center gap-x-2',
    pill: cn(
      'rounded-3xl w-20 h-32 scale-90 relative overflow-hidden border-2',
      bg('hoverBg'),
      br('divider'),
    ),
    pillHighlight: cn('h-36 mb-4 border-dashed', rainbow(COLOR_NAME.PURPLE, 'borderSoft')),
    pillNormal: global('gradient-black'),
    pillGadient: cn('absolute w-full h-full rotate-180', global('gradient-purple')),
    pillGadient2: cn('absolute w-full h-full rotate-180', global('gradient-orange')),
    pillGadient3: cn('absolute w-full h-full', global('gradient-red')),
    pillGadient4: cn('absolute w-full h-full', global('gradient-blue')),
    pillIcon: cn('size-5 absolute bottom-2 left-3.5', fill('text.digest')),
    pillHighlighIcon: cn(rainbow(COLOR_NAME.PURPLE, 'fill')),

    avatar: 'absolute size-7 circle saturate-50 opacity-20',
    avatarHighlight: 'saturate-100 opacity-100',
    //
  }
}
