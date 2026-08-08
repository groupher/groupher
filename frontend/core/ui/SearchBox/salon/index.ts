import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = TSpace

export default function useSalon({ ...spacing }: TProps) {
  const { cn, fg, br, margin, fill } = useTwBelt()

  return {
    wrapper: cn(
      'row-center group border border-transparent py-1 px-2.5 pointer rounded-md',
      `hover:${br('divider')}`,
      margin(spacing),
    ),
    icon: cn('size-3.5 mr-2 -mt-px group-smoky-65', fill('digest')),
    text: cn('text-xs group-smoky-80', fg('digest')),
  }
}
