import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, br, bg, primary, shadow, isBlackPrimary } = useTwBelt()

  return {
    wrapper: 'column-center w-8/12 pl-32',
    banner: cn('relative w-full h-36 border-b mb-10', br('divider')),
    tabs: 'absolute bottom-0 -left-2',
    content: 'column w-full',

    blockBase: cn(
      'relative border w-72 rounded-md px-4 py-4 border pointer saturate-0 opacity-55',
      'hover:opacity-100 hover:saturate-100 trans-all-200',
      `hover:${primary('borderSoft')}`,
      br('text.hint'),
      bg('alphaBg'),
    ),
    blockBaseActive: cn(
      'opacity-100 saturate-100',
      primary('borderSoft'),
      `hover:${primary('border')}`,
      isBlackPrimary && br('text.link'),
      shadow('md'),
    ),
  }
}
