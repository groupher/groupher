import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fill } = useTwBelt()

  return {
    wrapper: 'row-center mb-12 w-full',
    input: 'text-sm h-10 grow',
    plusIcon: cn('size-3 -ml-0.5 mr-1.5', fill('button.fg')),
    addBtn: 'h-8 ml-4 -mt-1.5',
  }
}
