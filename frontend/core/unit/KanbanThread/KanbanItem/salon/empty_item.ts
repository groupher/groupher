import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, br } = useTwBelt()

  return {
    wrapper: cn(
      'relative w-full pt-2.5 pb-3 px-2.5 mb-2.5 rounded-md border border-transparent',
      `hover:${br('divider')}`,
      bg('card'),
    ),
    header: 'row-between mb-2.5',
    title: cn('text-base w-full line-clamp-2', fg('title')),
  }
}
