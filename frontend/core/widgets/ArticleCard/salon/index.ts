import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, shadow, fg, br } = useTwBelt()

  return {
    wrapper: cn(
      'column relative h-auto rounded-md border',
      'px-4 py-2 mb-4 trans-all-100',
      shadow('xl'),
      br('divider'),
    ),
    titleLink: cn('text-base bold-sm line-clamp-2 no-underline', 'hover:underline', fg('title')),
    pinHintDot: 'absolute left-5 -top-2 -rotate-12 z-20',
    viewHintDot: 'absolute right-0.5 -top-0.5 z-20',
  }
}
