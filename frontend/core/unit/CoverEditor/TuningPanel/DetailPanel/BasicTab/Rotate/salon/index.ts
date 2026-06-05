import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, hover } = useTwBelt()

  return {
    wrapper: 'column w-full',
    sliderRow: 'row-center gap-3 w-full',
    reset: cn('text-xs px-1 py-0.5 shrink-0', fg('digest'), hover('bg')),
  }
}
