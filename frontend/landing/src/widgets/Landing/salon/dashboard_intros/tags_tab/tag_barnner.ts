import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    wrapper: 'mt-7 ml-1.5',
    header: 'row',
    hashIcon: cn('size-3.5 mr-1 mt-px opacity-65', rainbow(COLOR.GREEN, 'fill')),
    title: cn('text-xs', fg('title')),
    desc: cn('text-xs mt-1.5 w-52 leading-relaxed', fg('digest')),
  }
}
