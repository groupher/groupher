import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = TSpace

export default function useSalon({ ...spacing }: TProps) {
  const { cn, margin, hover } = useTwBelt()

  return {
    wrapper: cn(
      'align-both group w-auto text-xs border-none pointer',
      'trans-all-200',
      margin(spacing),
    ),
    backIcon: cn('size-3 mr-1.5 opacity-80 trans-all-200', hover('icon')),
    text: cn('text-xs', hover('fg')),
  }
}
