import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, br } = useTwBelt()

  return {
    empty: cn('px-4 py-5 text-xs border rounded-sm text-center', fg('hint'), br('divider')),
    wrapper: 'w-full',
  }
}
