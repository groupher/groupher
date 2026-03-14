import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, bg, shadow, rainbow } = useTwBelt()

  return {
    wrapper: 'relative s-full p-4 overflow-hidden',
    block: cn(
      'align-both w-64 h-40 relative p-2.5 overflow-hidden rounded-md trans-all-200',
      bg('card'),
      shadow('sm'),
    ),
    mask: bg('hoverBg'),

    bar: cn('absolute top-1 w-20 h-5 rounded-md opacity-20', bg('text.digest')),
    redBg: rainbow(COLOR.RED, 'bg'),
  }
}
