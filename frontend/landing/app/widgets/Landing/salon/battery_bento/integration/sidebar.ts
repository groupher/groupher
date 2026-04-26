import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, bg, br, shadow, rainbow } = useTwBelt()

  return {
    wrapper: cn(
      'absolute top-2 w-20 h-36 border rounded-md p-1.5 z-30 trans-all-200 opacity-0',
      shadow('sm'),
      br('divider'),
      bg('card'),
    ),
    avatar: cn('size-5 z-40 circle border border-transparent absolute', shadow('sm')),
    brGreen: rainbow(COLOR.GREEN, 'border'),
    brBlue: rainbow(COLOR.BLUE, 'border'),
    brORange: rainbow(COLOR.ORANGE, 'border'),
    bar: cn('absolute left-2 w-12 h-1.5 rounded-md opacity-30', bg('digest')),
  }
}
