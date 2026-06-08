import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, fg, bg, hover, primary } = useTwBelt()

  return {
    wrapper: 'column w-full min-w-0',
    items: 'column gap-4 w-full min-w-0',
    chips: 'row-center wrap gap-2',
    chip: cn('size-6 circle border-2 pointer trans-all-200', br('divider')),
    renderers: 'flex flex-wrap items-start justify-start gap-1.5',
    rendererButton: cn(
      'h-6 px-1.5 rounded-md border text-xs leading-none pointer trans-all-200',
      br('divider'),
      fg('digest'),
      bg('card'),
      hover('bg'),
    ),
    rendererButtonActive: cn(primary('border'), primary('fg')),
    angle: 'flex justify-start',
  }
}
