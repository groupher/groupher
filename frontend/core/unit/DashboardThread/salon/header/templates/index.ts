import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, bg, primary, shadow } = useTwBelt()

  return {
    wrapper: 'column w-full gap-4 pb-8',
    options: 'column gap-y-6',
    action: 'align-both w-full',
    template: cn(
      'w-full h-16 border rounded-md pointer',
      `hover:${primary('border')}`,
      br('divider'),
      bg('alphaBg'),
      'trans-all-100',
    ),
    templateActive: cn(primary('borderSoft'), shadow('md')),
    arrowIcon: cn('size-3.5 ml-0.5', primary('fill')),
  }
}
