import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'column mb-4 -mt-1',
    title: cn('text-sm mb-2.5', fg('digest')),
  }
}
