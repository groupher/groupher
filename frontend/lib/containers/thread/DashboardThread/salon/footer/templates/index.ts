import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, primary, br, bg, shadow } = useTwBelt()

  return {
    wrapper: cn('column items-center w-full gap-4 pb-8'),
    template: cn(
      'w-11/12 h-16 border rounded-md pointer',
      `hover:${primary('border')}`,
      br('divider'),
      bg('alphaBg'),
      'trans-all-100',
    ),
    templateActive: cn(primary('borderSoft'), shadow('md')),
    arrowIcon: cn('size-3.5 ml-0.5 rotate-180', primary('fill')),
  }
}
