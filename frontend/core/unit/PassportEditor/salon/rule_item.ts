import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, primary } = useTwBelt()

  return {
    wrapper: 'row-center min-w-0 w-full overflow-hidden',
    title: cn('text-sm ml-2 min-w-flex truncate', fg('digest')),
    primaryTitle: cn('text-sm ml-2 min-w-flex truncate', primary('fg')),
  }
}
