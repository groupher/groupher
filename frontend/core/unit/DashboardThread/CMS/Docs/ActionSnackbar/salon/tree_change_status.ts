import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: cn('row-center min-w-0 max-w-72 gap-2 shrink-0 px-1', fg('digest')),
    icon: cn('size-4.5 shrink-0', fill('digest')),
    label: 'truncate text-xs bold-sm',
  }
}
