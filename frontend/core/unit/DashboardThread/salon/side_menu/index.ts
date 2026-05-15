import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('column w-40 min-w-40', fg('digest')),
    menuStack: 'grid w-full',
    menuLayer: 'w-full col-start-1 row-start-1',
  }
}
