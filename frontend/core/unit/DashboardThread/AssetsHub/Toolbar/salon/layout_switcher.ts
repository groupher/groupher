import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, primary } = useTwBelt()

  return {
    icon: 'size-3.5',
    option: ({ active }: { active: boolean }) =>
      cn(
        'align-both size-6 rounded-sm transition-colors',
        active ? primary('fg') : fg('digest'),
        active && bg('card'),
        !active && 'opacity-60 hover:opacity-100',
        !active && `hover:${fg('title')}`,
      ),
    wrapper: cn('row-center gap-0.5 rounded-sm px-0.5 py-0.5', bg('hoverBg')),
  }
}
