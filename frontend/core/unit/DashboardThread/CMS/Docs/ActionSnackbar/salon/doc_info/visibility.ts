import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, primary, rainbow } = useTwBelt()

  return {
    published: cn('row-center gap-1.5 text-sm', rainbow(COLOR.GREEN, 'fg')),
    publishedIcon: cn('size-4 shrink-0', rainbow(COLOR.GREEN, 'fill')),
    unpublished: cn('row-center gap-1.5 text-sm', rainbow(COLOR.ORANGE, 'fg')),
    unpublishedDot: cn('block size-1.5 shrink-0 rounded-full', primary('bg')),
  }
}
