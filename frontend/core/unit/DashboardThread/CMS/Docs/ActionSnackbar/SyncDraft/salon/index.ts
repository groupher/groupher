import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, accent, hover, rainbow } = useTwBelt()

  return {
    button: cn('align-both size-7 rounded-lg button-reset', fg('digest'), hover('box')),
    savedIcon: cn('size-4.5', fg('digest')),
    dirtyDot: cn('size-1.5 rounded-full', accent('bg')),
    errorDot: cn('size-1.5 rounded-full', rainbow(COLOR.RED, 'bg')),
    syncIcon: cn('size-3.5 animate-spin', fg('digest')),
  }
}
