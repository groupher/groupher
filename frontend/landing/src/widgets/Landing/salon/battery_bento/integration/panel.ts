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

    bar: cn('absolute rounded-md', bg('digest')),
    redBar: cn('absolute rounded-md', rainbow(COLOR.RED, 'bg')),
  }
}
