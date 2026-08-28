import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, fill, rainbow } = useTwBelt()

  return {
    wrapper: 'absolute top-14 right-9 w-20 h-56 pt-12',
    tag: 'row-center mb-2 opacity-65',
    icon: cn('size-3 rotate-12 mr-2 opacity-40', fill('digest')),
    fillGreen: rainbow(COLOR.GREEN, 'fill'),
    title: cn('text-xs', fg('digest')),
    //
    bar: cn('absolute h-1.5 w-20 rounded-md opacity-20', bg('digest')),
  }
}
