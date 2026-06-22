import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = TSpace

export default function useSalon({ ...spacing }: TProps) {
  const { cn, fg, br, margin, primary } = useTwBelt()

  return {
    wrapper: cn('border-b pb-4 mb-6', br('divider'), margin(spacing)),
    header: 'row-between mb-1.5 w-full',
    tagWrapper: 'align-both h-6 mb-1',
    title: cn('text-lg ml-0.5', fg('title')),
    stats: 'row-center text-sm gap-x-1.5 mr-2',
    statLabel: cn('text-xs', fg('digest')),
    statNum: cn('font-medium', primary('fg')),
  }
}
