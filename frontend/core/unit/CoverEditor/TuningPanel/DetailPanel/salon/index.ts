import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, hover } = useTwBelt()

  return {
    wrapper: 'relative column gap-3 w-full px-6 py-5 pb-12',
    themeRow: 'row-center justify-center w-full',
    tabRow: 'row-center justify-center w-full',
    content: 'w-full min-h-32',
    collapseRow: 'absolute left-1/2 bottom-3 -translate-x-1/2',
    collapseBtn: cn('text-xs px-1 py-0.5', fg('digest'), hover('bg')),
  }
}
