import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'align-both absolute rotate-3 bottom-16 right-16 rounded-xl w-44 gap-x-4 py-2',
      bg('card'),
      shadow('lg'),
    ),
    item: 'align-both',
    emoji: 'size-4 opacity-80',
    count: cn('text-base ml-1.5 bold-sm', fg('digest')),
  }
}
