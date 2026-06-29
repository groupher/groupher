import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, primary } = useTwBelt()

  return {
    wrapper: cn('row-center mt-2 shrink-0 gap-2 text-base bold-sm opacity-80', primary('fg')),
    dot: cn('block size-2 rounded-full', primary('bg')),
  }
}
