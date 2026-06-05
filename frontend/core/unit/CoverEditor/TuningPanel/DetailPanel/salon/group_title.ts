import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, sexyBorder } = useTwBelt()

  return {
    wrapper: 'row-center w-full gap-4 mb-3',
    title: cn('text-sm shrink-0', fg('title')),
    line: cn(sexyBorder(), 'flex-1'),
  }
}
