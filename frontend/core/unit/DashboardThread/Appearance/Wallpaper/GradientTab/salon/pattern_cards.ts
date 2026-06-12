import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, fg, hover, bg, sexyBorder } = useTwBelt()
  const toggleBase = 'h-8 px-5 rounded-full'

  return {
    wrapper: 'w-full mt-5',
    title: cn('text-sm mb-5', fg('digest')),
    grid: 'grid w-full grid-cols-7 gap-4',
    card: 'h-40 w-full',
    preview: 'block s-full rounded-md',
    toggleSlot: 'h-40 row-center',
    toggle: cn(
      toggleBase,
      'row-center text-sm transition pointer border',
      hover('box'),
      br('divider'),
    ),
    dividerRow: cn('relative flex justify-center mt-7', sexyBorder()),
    toggleMask: cn(
      'absolute -top-4 h-8 -ml-4 px-6 rounded-full pointer-events-none row-center text-sm opacity-100',
      bg('card'),
    ),
    toggleFloating: cn(
      'absolute -top-4 h-8 -ml-4 px-5 rounded-full group row-center text-sm transition pointer border',
      hover('box'),
      br('divider'),
    ),
    toggleText: cn('text-sm', hover('fg')),
  }
}
