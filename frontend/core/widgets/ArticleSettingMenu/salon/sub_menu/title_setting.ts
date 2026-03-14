import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'mr-1',
    input: 'w-full h-8',
    note: cn('text-xs mt-2.5 mb-1.5', fg('hint')),
  }
}
