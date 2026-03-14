import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, br, fill, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'mt-10 w-44 h-auto mb-6 p-4 rounded-md border',
      bg('cardAlpha'),
      br('rainbow.cyanSoft'),
      shadow('card'),
    ),
    pinnedItem: 'row-center mb-0.5',
    icon: cn('size-3 mr-1 -mt-1', fill('digest')),
    file: cn('text-xs mb-2 ml-1', fg('digest')),
    dir: cn('text-xs bold-sm mb-2', fg('title')),
  }
}
