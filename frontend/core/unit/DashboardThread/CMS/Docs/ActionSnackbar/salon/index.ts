import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg } = useTwBelt()

  return {
    wrapper: cn(
      'row-center sticky bottom-16 self-center',
      'h-12 w-fit pr-4 pl-3 rounded-2xl shadow-lg z-30',
      bg('card'),
    ),
    treeGroup: 'row-center gap-1',
    divider: 'h-5 w-px mx-2 bg-white/20 dark:bg-white/25',
    actionGroup: 'row-center gap-1',
    commitGroup: 'row-center gap-1',
  }
}
