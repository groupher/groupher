import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon({ stacked }) {
  const { cn, cnMerge, fg, fill, primary, shadow, hover } = useTwBelt()

  return {
    wrapper: cnMerge(
      'row-center w-fit gap-x-1 pr-1',
      stacked && cn('pr-3 gap-x-0 ml-0.5', hover('box')),
    ),
    backButton: 'align-both size-4',
    dotWrapper: cnMerge('align-both size-7 circle', stacked && '-mr-2.5 size-6 scale-80'),
    dot: cn(
      'size-5.5 circle align-both pointer trans-all-100',
      !stacked && 'hover:-mt-0.5',
      stacked && 'size-5',
    ),
    dotActive: cn(
      'size-6 align-both border border-transparent',
      primary('borderSoft'),
      shadow('md'),
    ),
    backIcon: cn('size-4 pointer', fill('button.fg')),
    checkIcon: cn('size-3', fill('button.fg')),
    customBlock: 'mt-1.5 px-1.5 pb-1.5',
    customTitle: cn('mb-2 text-base opacity-65', fg('digest')),
  }
}
