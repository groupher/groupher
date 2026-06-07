import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, bg, hover, sexyBorder } = useTwBelt()
  const toggleBase = 'absolute -top-3 h-6 -ml-4 px-4 rounded-full'

  return {
    wrapper: 'row align-start flex-wrap justify-between gap-y-8',
    moreColorsClip: 'w-full overflow-hidden',
    moreColors: 'row align-start flex-wrap justify-between',
    dividerRow: cn('relative flex justify-center mt-6 mb-4', sexyBorder()),
    toggleMask: cn(
      toggleBase,
      'pointer-events-none row-center px-[calc(1rem+2px)] text-xs opacity-100',
      bg('card'),
    ),
    toggle: cn(
      toggleBase,
      'group row-center text-xs transition pointer border',
      hover('box'),
      br('divider'),
    ),
    toggleText: cn('text-xs', hover('fg')),
  }
}
