import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fill, hover, avatar, fg, rainbow } = useTwBelt()

  return {
    wrapper: cn('row-center relative py-2 px-1 -ml-2', hover('bg')),
    expandIcon: cn('size-3.5 mr-3.5', fill('digest')),
    avatar: cn('size-4 mr-2.5', avatar()),
    createDate: cn('row-center justify-end text-xs ml-0.5 min-w-10 mr-1 break-keep', fg('hint')),
    commentBody: cn('text-sm grow line-clamp-1', fg('digest')),
    repliesHint: cn('text-xs mr-1.5', fg('link')),
    solutionIcon: cn('size-3.5 ml-px mt-0.5', rainbow(COLOR.GREEN, 'fill')),
  }
}
