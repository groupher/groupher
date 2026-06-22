import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, fg } = useTwBelt()

  return {
    wrapper: cn('row-center pointer mr-1.5 px-2 py-1 ml-0.5 rounded-md border', br('divider')),
    count: fg('digest'),
  }
}
