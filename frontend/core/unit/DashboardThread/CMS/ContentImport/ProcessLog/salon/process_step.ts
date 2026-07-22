import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

/** Returns active, completed, pending, and failed classes for one process stage. */
export default function useSalon() {
  const { cn, bg, fg, primary, rainbow } = useTwBelt()

  return {
    item: 'flex min-h-6 items-start gap-2.5',
    iconBox: 'align-both mt-0.5 size-5 shrink-0',
    activeIconBox: 'align-both mt-0.5 size-5 shrink-0',
    pendingIconBox: 'align-both mt-0.5 size-5 shrink-0',
    failedIconBox: 'align-both mt-0.5 size-5 shrink-0',
    checkIcon: cn('size-3', rainbow(COLOR.GREEN, 'fill')),
    loadingIcon: cn('size-3.5 animate-spin', primary('fill')),
    pendingDot: cn('size-1.5 circle opacity-50', bg('digest')),
    failedIcon: cn('size-3', rainbow(COLOR.RED, 'fill')),
    content: 'min-w-0 flex-1',
    activeLabel: 'shimmer-text text-sm text-pretty',
    label: cn('text-sm text-pretty', fg('title')),
    pendingLabel: cn('text-sm text-pretty', fg('digest')),
    details: 'mt-1 space-y-0.5',
    detail: cn('flex items-start gap-2 text-xs leading-5 text-pretty', fg('digest')),
    activeDetailText: 'shimmer-text',
    detailDot: cn('mt-2 size-1 shrink-0 circle opacity-50', bg('digest')),
  }
}
