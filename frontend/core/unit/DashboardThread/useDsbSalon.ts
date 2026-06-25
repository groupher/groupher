import useTwBelt from '~/hooks/useTwBelt'

export default function useDsbSalon() {
  const { cn, br, bg, hoverBr, shadow, primary, sexyBorder, vividDark } = useTwBelt()

  return {
    wrapper: 'column w-3/5 ',
    banner: cn('relative h-16 w-full border-b mb-10', br('divider')),
    tabs: 'absolute -left-2 bottom-0',

    section: 'pb-7',
    card: cn(
      'relative w-72 rounded-md border p-4 pointer saturate-0 opacity-80 overflow-hidden trans-all-100',
      'hover:opacity-100 hover:saturate-100',
      br('divider'),
      `hover:${primary('border')}`,
      bg('alphaBg'),
    ),
    cardActive: cn(
      'opacity-100 saturate-100',
      primary('borderSoft'),
      `hover:${primary('border')}`,
      shadow('md'),
    ),

    box: cn('relative rounded-md', hoverBr()),
    divider: cn(sexyBorder(), 'mt-14 mb-14'),

    bar: cn('h-1.5 w-20 opacity-30 rounded', primary('bg'), vividDark()),
    circle: cn('size-2 circle opacity-40', primary('bg'), vividDark()),
    icon: cn('size-3 opacity-65', primary('fill')),
  }
}
