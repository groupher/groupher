import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

/** Returns presentation classes for the bounded recent item outcome list. */
export default function useSalon() {
  const { cn, br, fg, rainbow } = useTwBelt()

  return {
    wrapper: cn('mt-5 border-t pt-4', br('divider')),
    title: cn('text-xs font-medium', fg('digest')),
    list: 'mt-2 space-y-1.5',
    item: 'row-center min-w-0 gap-2',
    completedMark: cn('shrink-0 text-xs', rainbow(COLOR.GREEN, 'fg')),
    skippedMark: cn('shrink-0 text-xs', fg('digest')),
    failedMark: cn('shrink-0 text-xs', rainbow(COLOR.RED, 'fg')),
    label: cn('min-w-0 truncate font-mono text-xs', fg('title')),
    state: cn('ml-auto shrink-0 text-xs', fg('digest')),
  }
}
