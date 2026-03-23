import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'row-center mt-4 mb-1 -ml-0.5',
    slash: cn('text-xs ml-1.5 mr-1.5', fg('hint')),
    cur: cn('text-xs', fg('digest')),
  }
}
