import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, bg } = useTwBelt()

  return {
    wrapper: cn(
      'column-center relative w-full rounded-xl border border-b-none w-[680px] h-96',
      bg('alphaBg'),
      br('divider'),
    ),
  }
}
