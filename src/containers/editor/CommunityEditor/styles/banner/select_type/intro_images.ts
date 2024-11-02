import useTwBelt from '~/hooks/useTwBelt'
import { COLOR_NAME } from '~/const/colors'

export { cn } from '~/css'

export default () => {
  const { cn, bg, br, shadow, rainbow } = useTwBelt()

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
    active: 'bottom-1 opacity-100 scale-100',
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

    textImage: cn('rounded-lg w-full h-full object-cover'),
    text2Image: 'absolute bottom-5 right-2 rounded-xl size-24 object-cover -rotate-3',
  }
}
