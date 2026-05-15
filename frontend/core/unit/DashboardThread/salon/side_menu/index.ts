import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('column w-40 min-w-40', fg('digest')),
    menuLayer: 'w-full',
  }
}
