import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, br, primary } = useTwBelt()

  return {
    icon: 'size-4',
    option: ({ active }: { active: boolean }) =>
      cn(
        'align-both size-7 rounded-sm border border-transparent transition-colors',
        active ? primary('fg') : fg('digest'),
        active && primary('borderLite'),
        !active && `hover:${fg('title')}`,
      ),
    wrapper: cn('row-center gap-0.5 rounded-sm border px-1 py-1', br('divider')),
  }
}
