import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, fg, primary } = useTwBelt()

  return {
    wrapper: cn('relative size-14 circle border select-none touch-none pointer', br('divider')),
    center: cn('align-both absolute inset-0 text-xs tabular-nums', fg('digest')),
    point: cn('absolute size-2.5 circle shadow-sm', primary('bg')),
  }
}
