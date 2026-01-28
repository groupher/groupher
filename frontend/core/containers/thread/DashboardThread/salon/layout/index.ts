import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, br, hoverBr, bg, fill, shadow, primary, sexyBorder, vividDark, isBlackPrimary } =
    useTwBelt()

  return {
    wrapper: 'column w-3/5 ',
    banner: cn('relative h-16 w-full border-b mb-10', br('divider')),
    tabs: 'absolute -left-2 bottom-0',
    //
    baseSection: 'pb-7',
    blockBase: cn(
      'relative w-72 rounded-md px-4 py-4 pointer saturate-0 opacity-80',
      'hover:opacity-100 hover:saturate-100',
      hoverBr(),
      bg('alphaBg'),
    ),
    blockBaseActive: cn(
      'opacity-100 saturate-100',
      primary('borderSoft'),
      `hover:${primary('border')}`,
      isBlackPrimary && br('text.link'),
      shadow('md'),
    ),

    box: cn('relative rounded-md border', primary('borderSoft'), isBlackPrimary && br('text.link')),
    divider: cn(sexyBorder(), 'mt-14 mb-14'),

    // basic shape
    bar: cn('absolute h-1.5 w-20 opacity-40 rounded', primary('bg'), vividDark()),
    circle: cn(
      'absolute size-2 circle opacity-40',
      primary('bg'),
      isBlackPrimary && bg('text.link'),
      vividDark(),
    ),
    icon: cn('absolute size-3 opacity-65', primary('fill'), isBlackPrimary && fill('link')),
  }
}
