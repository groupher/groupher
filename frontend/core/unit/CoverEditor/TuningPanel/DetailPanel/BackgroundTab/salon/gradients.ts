import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, cnMerge, selectable } = useTwBelt()

  return {
    section: 'column gap-3 w-full',
    gradientGrid: 'row-center wrap gap-2',
    button: (active: boolean) =>
      cnMerge(
        selectable('box', { active, isCircle: true }),
        'relative p-1 shrink-0 circle trans-all-200 text-left size-10',
      ),
    content: 'row-center s-full overflow-hidden circle',
    activeSign: cnMerge(
      selectable('badge', { isCircle: true, size: 'sm' }),
      '-top-1.5 -right-1 scale-80',
    ),
    checkIcon: cn(selectable('check', { isCircle: true, size: 'sm' })),
  }
}
