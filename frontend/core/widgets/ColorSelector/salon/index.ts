import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fill, primary, shadow } = useTwBelt()

  return {
    content: 'w-full px-1',
    selectRow: 'row-center w-fit gap-x-1.5',
    buildInWrapper: 'w-full',
    dotWrapper: 'align-both size-7 circle',
    dot: cn('size-5.5 circle align-both pointer trans-all-100', 'hover:-mt-0.5'),
    dotActive: cn(
      'size-6 align-both border border-transparent',
      primary('borderSoft'),
      shadow('md'),
    ),
    checkIcon: cn('size-3', fill('button.fg')),
    customBlock: 'mt-1.5 max-w-full px-1.5 pb-1.5',
  }
}
