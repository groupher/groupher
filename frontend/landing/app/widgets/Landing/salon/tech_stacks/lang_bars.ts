import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, rainbow, fg } = useTwBelt()

  return {
    wrapper: 'w-48 mt-2.5 saturate-80',
    barWrapper: 'row-center',
    langWrapper: cn('row-center text-xs mt-2', fg('title')),
    bar: 'h-1.5',
    bgPurple: rainbow(COLOR.PURPLE, 'bg'),
    bgBlue: rainbow(COLOR.BLUE, 'bg'),
    //
    lang: 'row-center mr-5',
    dot: 'size-2 circle mr-2',
  }
}
