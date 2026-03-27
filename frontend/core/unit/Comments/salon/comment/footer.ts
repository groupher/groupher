import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill, rainbow } = useTwBelt()

  return {
    wrapper: 'column mb-1 -ml-2 mt-3',
    main: 'row-center',
    extra: 'row-center mb-3.5 px-2',
    anwser: cn('text-xs row-center mr-4 bold-sm', rainbow(COLOR.GREEN, 'fg')),
    checkIcon: cn('size-3.5 mr-1 mt-px', rainbow(COLOR.GREEN, 'fill')),
    authorUpvote: cn('text-xs row-center scale-90', fg('link')),
    upvoteIcon: cn('size-3 mr-1.5 -mt-px', fill('link')),
  }
}
