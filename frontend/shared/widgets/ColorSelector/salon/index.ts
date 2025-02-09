import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fill, primary, shadow } = useTwBelt()

  return {
    wrapper: 'row-center pl-1.5 pr-1.5 gap-x-1.5',
    dotWrapper: cn('align-both size-7 circle'),
    dot: cn('size-5 circle pointer trans-all-100', 'hover:-mt-0.5'),
    dotActive: cn(
      'size-6 align-both border border-transparent',
      primary('borderSoft'),
      shadow('md'),
    ),
    checkIcon: cn('size-3', fill('button.fg')),
  }
}
